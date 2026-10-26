alter table public.company
  add column jd_text text check (length(jd_text) <= 30000),
  add column jd_updated_at timestamptz,
  add column source text check (length(source) <= 2000);

create function public.stamp_company_jd() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.jd_updated_at := case when new.jd_text is not null then clock_timestamp() end;
  elsif new.jd_text is distinct from old.jd_text then
    new.jd_updated_at := clock_timestamp();
  else
    new.jd_updated_at := old.jd_updated_at;
  end if;
  return new;
end;
$$;
revoke all on function public.stamp_company_jd() from public, anon, authenticated;
create trigger stamp_company_jd before insert or update on public.company
for each row execute function public.stamp_company_jd();

create table public.job_submissions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.company(id) on delete cascade,
  submitted_on date,
  channel text check (length(channel) <= 200),
  note text check (length(note) <= 4000),
  created_at timestamptz not null default now(),
  supplemented_at timestamptz,
  jd_text text,
  jd_updated_at timestamptz,
  material_kind text not null check (material_kind in ('pending', 'platform', 'file')),
  resume_id uuid,
  version_id bigint,
  projection_reference_date date,
  snapshot jsonb,
  template_manifest jsonb,
  file_path text unique,
  file_name text,
  file_mime text,
  file_size integer check (file_size between 1 and 10485760),
  file_hash text,
  request_payload jsonb not null,
  material_payload jsonb,
  constraint job_submission_material check (
    (material_kind = 'pending' and projection_reference_date is null and snapshot is null and template_manifest is null and file_path is null and resume_id is null)
    or (material_kind = 'platform' and projection_reference_date is not null and resume_id is not null and snapshot is not null and template_manifest is not null and jsonb_typeof(snapshot) = 'object' and jsonb_typeof(template_manifest) = 'object' and file_path is null)
    or (material_kind = 'file' and projection_reference_date is null and resume_id is null and snapshot is null and template_manifest is null and file_path is not null and file_name is not null and file_mime in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document') and file_size is not null and file_hash is not null and file_hash ~ '^[0-9a-f]{64}$')
  )
);
create index job_submissions_job_created on public.job_submissions(user_id, job_id, created_at desc);
alter table public.job_submissions enable row level security;
revoke all on public.job_submissions from public, anon, authenticated;
grant select (id,user_id,job_id,submitted_on,channel,note,created_at,supplemented_at,material_kind,resume_id,version_id,file_name,file_mime,file_size,jd_updated_at) on public.job_submissions to authenticated;
grant all on public.job_submissions to service_role;
create policy job_submissions_owner_read on public.job_submissions for select to authenticated
using (user_id = (select auth.uid()) and exists (select 1 from public.company c where c.id = job_id and c.user_id = (select auth.uid())));
create policy job_submissions_service on public.job_submissions for all to service_role using (true) with check (true);

-- No client storage policies: every read passes through the authenticated function
-- and checks both submission and current job ownership. No signed bearer URLs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('job-submission-materials','job-submission-materials',false,10485760,
array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
create policy job_materials_no_client_objects on storage.objects as restrictive
for all to anon, authenticated
using (bucket_id <> 'job-submission-materials')
with check (bucket_id <> 'job-submission-materials');
create policy job_materials_no_client_bucket_insert on storage.buckets as restrictive
for insert to anon, authenticated with check (id <> 'job-submission-materials');
create policy job_materials_no_client_bucket_update on storage.buckets as restrictive
for update to anon, authenticated using (id <> 'job-submission-materials')
with check (id <> 'job-submission-materials');
create policy job_materials_no_client_bucket_delete on storage.buckets as restrictive
for delete to anon, authenticated using (id <> 'job-submission-materials');

-- The Edge Function validates bytes before supplying file metadata. Only the
-- service role can call this RPC; clients cannot forge snapshots or object paths.
create function public.save_job_submission(
  p_user_id uuid, p_id uuid, p_job_id uuid, p_input jsonb,
  p_material jsonb, p_supplement boolean default false
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_job public.company%rowtype;
  v_row public.job_submissions%rowtype;
  v_source jsonb;
  v_binding jsonb;
  v_definition jsonb;
  v_manifest jsonb;
  v_kind text := p_material ->> 'kind';
  v_resume uuid := (p_material ->> 'resumeId')::uuid;
  v_version bigint := (p_material ->> 'versionId')::bigint;
  v_projection_date date;
  v_stages jsonb;
begin
  if p_user_id is null or p_id is null or p_job_id is null
    or p_input is null or p_material is null or v_kind is null
    or v_kind not in ('pending','platform','file')
    or (v_kind = 'platform' and v_resume is null)
    or (v_kind <> 'platform' and (v_resume is not null or v_version is not null))
    or (p_supplement and v_kind = 'pending') then
    raise exception 'invalid_submission' using errcode = '22023';
  end if;
  -- Stable lock order serializes replays, supplements and concurrent job writes.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text, 718));
  select * into v_job from public.company where id = p_job_id and user_id = p_user_id for update;
  if not found then raise exception 'job_not_found' using errcode = '42501'; end if;
  select * into v_row from public.job_submissions where id = p_id for update;
  if found then
    if v_row.user_id <> p_user_id or v_row.job_id <> p_job_id then
      raise exception 'submission_not_found' using errcode = '42501';
    end if;
    if not p_supplement then
      if v_row.request_payload is distinct from jsonb_build_object('input',p_input,'material',p_material - 'path') then
        raise exception 'request_conflict' using errcode = '23505';
      end if;
      return to_jsonb(v_row) - array['snapshot','template_manifest','request_payload','material_payload','file_path','file_hash','jd_text'];
    end if;
    if v_row.material_kind <> 'pending' then
      if v_row.material_payload is not distinct from (p_material - 'path') then
        return to_jsonb(v_row) - array['snapshot','template_manifest','request_payload','material_payload','file_path','file_hash','jd_text'];
      end if;
      raise exception 'material_already_saved' using errcode = '23505';
    end if;
  elsif p_supplement then
    raise exception 'submission_not_found' using errcode = '42501';
  end if;

  if v_kind = 'platform' then
    if v_version is null then
      select to_jsonb(r) into v_source from public.resume_config r
      where r.resume_id = v_resume and r.user_id = p_user_id for share;
      v_projection_date := (clock_timestamp() at time zone 'UTC')::date;
    else
      select r.snapshot, r.projection_reference_date into v_source, v_projection_date from public.resume_config_versions r
      join public.resume_config c on c.resume_id = r.resume_id
      where r.id = v_version and r.resume_id = v_resume and r.user_id = p_user_id and c.user_id = p_user_id for share of r,c;
    end if;
    if v_source is null then raise exception 'resume_not_found' using errcode = '42501'; end if;
    if v_projection_date is null then raise exception 'projection_date_missing' using errcode = '22023'; end if;
    v_binding := coalesce(v_source -> 'templateBinding',v_source -> 'template_binding');
    if v_binding ->> 'source' is distinct from 'official' then
      raise exception 'template_missing' using errcode = '22023';
    end if;
    select content::jsonb into v_definition from public.official_resume_template_versions
    where template_id = v_binding ->> 'templateId' and version = (v_binding ->> 'templateVersion')::integer and published_at is not null;
    if v_definition is null then raise exception 'template_missing' using errcode = '22023'; end if;
    v_manifest := jsonb_build_object('schemaVersion',3,'templateId',v_binding ->> 'templateId','templateVersion',(v_binding ->> 'templateVersion')::integer,'definition',v_definition,'assets',v_definition -> 'assets');
    -- Preserve all body, visibility and appearance fields, without account data.
    select jsonb_object_agg(key,value) into v_source from jsonb_each(v_source)
    where key = any(array['basics','job_intent','application_info','edu_background','work_experience','internship_experience','campus_experience','project_experience','skill_specialty','honors_certificates','self_evaluation','hobbies','order','visibility','type','template_binding','templateBinding','spacing','font','theme']);
  elsif v_kind = 'file' then
    if p_material ->> 'path' not like p_user_id::text || '/' || p_id::text || '/%'
      or not exists (select 1 from storage.objects where bucket_id = 'job-submission-materials' and name = p_material ->> 'path') then
      raise exception 'file_missing' using errcode = '22023';
    end if;
  end if;

  if p_supplement then
    update public.job_submissions set
      material_kind = v_kind, resume_id = v_resume, version_id = v_version,
      projection_reference_date = v_projection_date,
      snapshot = v_source, template_manifest = v_manifest,
      file_path = p_material ->> 'path', file_name = p_material ->> 'name',
      file_mime = p_material ->> 'mime', file_size = (p_material ->> 'size')::integer,
      file_hash = p_material ->> 'hash', material_payload = p_material - 'path',
      supplemented_at = clock_timestamp()
    where id = p_id returning * into v_row;
  else
    insert into public.job_submissions(id,user_id,job_id,submitted_on,channel,note,jd_text,jd_updated_at,material_kind,resume_id,version_id,projection_reference_date,snapshot,template_manifest,file_path,file_name,file_mime,file_size,file_hash,request_payload,material_payload)
    values(p_id,p_user_id,p_job_id,(p_input ->> 'submittedOn')::date,p_input ->> 'channel',p_input ->> 'note',v_job.jd_text,v_job.jd_updated_at,v_kind,v_resume,v_version,v_projection_date,v_source,v_manifest,p_material ->> 'path',p_material ->> 'name',p_material ->> 'mime',(p_material ->> 'size')::integer,p_material ->> 'hash',jsonb_build_object('input',p_input,'material',p_material - 'path'),p_material - 'path')
    returning * into v_row;
    if v_job.status = 'saved' then
      select jsonb_agg(
        coalesce((select d from jsonb_array_elements(coalesce(v_job.stage_details,'[]'::jsonb)) d where d ->> 'stage' = s.stage limit 1),jsonb_build_object('stage',s.stage,'start_date',null,'notes',''))
        || jsonb_build_object('status',case when s.stage = 'applied' then '进行中' when s.stage = 'saved' then '已完成' else '待处理' end)
        || case when s.stage = 'applied' then jsonb_build_object('start_date',coalesce((select d ->> 'start_date' from jsonb_array_elements(coalesce(v_job.stage_details,'[]'::jsonb)) d where d ->> 'stage' = 'applied' limit 1),p_input ->> 'submittedOn')) else '{}'::jsonb end
        order by s.ord) into v_stages
      from unnest(array['saved','applied','assessment','screen','written','interview','offer']) with ordinality s(stage,ord);
      update public.company set status = 'applied',stage_details = v_stages,
        interview_sub_stages = coalesce((select jsonb_agg(d || '{"status":"待处理"}'::jsonb order by (d ->> 'order')::numeric) from jsonb_array_elements(coalesce(v_job.interview_sub_stages,'[]'::jsonb)) d),'[]'::jsonb),
        activities = coalesce(v_job.activities,'[]'::jsonb) || jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'type','status_change','label','推进到「已投递」','at',clock_timestamp())),updated_at = clock_timestamp()
      where id = p_job_id;
    end if;
  end if;
  return to_jsonb(v_row) - array['snapshot','template_manifest','request_payload','material_payload','file_path','file_hash','jd_text'];
end;
$$;
revoke all on function public.save_job_submission(uuid,uuid,uuid,jsonb,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.save_job_submission(uuid,uuid,uuid,jsonb,jsonb,boolean) to service_role;
-- Free import has its own service-only admission ledger. It never touches the
-- paid AI quota/credit tables. Only source-validated basic fields are cached, not JD text.
create table public.job_profile_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  version smallint not null check (version > 0),
  status text not null check (status in ('processing', 'succeeded', 'failed')),
  attempts smallint not null check (attempts between 1 and 2),
  lease_id uuid,
  lease_expires_at timestamptz,
  mapping jsonb check (mapping is null or jsonb_typeof(mapping) = 'object'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, content_hash, version),
  check (
    (status = 'processing' and lease_id is not null and lease_expires_at is not null and mapping is null)
    or (status = 'succeeded' and lease_id is null and lease_expires_at is null and mapping is not null)
    or (status = 'failed' and lease_id is null and lease_expires_at is null and mapping is null)
  )
);

create index job_profile_requests_expiry_idx
  on public.job_profile_requests (expires_at);

create table public.job_profile_daily_attempts (
  day date not null,
  scope text not null check (scope = 'global' or scope ~ '^user:[0-9a-f-]{36}$'),
  attempts integer not null default 0 check (attempts >= 0),
  primary key (day, scope)
);

alter table public.job_profile_requests enable row level security;
alter table public.job_profile_daily_attempts enable row level security;

revoke all on public.job_profile_requests from public, anon, authenticated;
revoke all on public.job_profile_daily_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.job_profile_requests to service_role;
grant select, insert, update, delete on public.job_profile_daily_attempts to service_role;

create policy job_profile_requests_service_only on public.job_profile_requests
  for all to service_role using (true) with check (true);
create policy job_profile_daily_attempts_service_only on public.job_profile_daily_attempts
  for all to service_role using (true) with check (true);

create function public.reserve_job_profile(
  p_user_id uuid,
  p_content_hash text,
  p_version smallint,
  p_user_daily_limit integer default 10,
  p_global_daily_limit integer default 1000
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_day date;
  v_user_scope text := 'user:' || p_user_id::text;
  v_request public.job_profile_requests%rowtype;
  v_lease_id uuid;
  v_global_attempts integer;
  v_user_attempts integer;
begin
  if p_user_id is null or p_content_hash is null
    or p_content_hash !~ '^[0-9a-f]{64}$'
    or p_version is null or p_version <= 0
    or p_user_daily_limit is null or p_user_daily_limit not between 0 and 1000000
    or p_global_daily_limit is null or p_global_daily_limit not between 0 and 1000000 then
    raise exception 'invalid import reservation';
  end if;

  -- This short transaction serializes admissions across accounts and hashes.
  -- It prevents both cache misses and daily counters racing past their limits.
  perform pg_catalog.pg_advisory_xact_lock(728344, 2);
  v_now := clock_timestamp();
  v_day := (v_now at time zone 'UTC')::date;

  -- Opportunistic bounded-retention cleanup also runs on cache-hit requests.
  delete from public.job_profile_requests
  where expires_at <= v_now
    and (status <> 'processing' or lease_expires_at <= v_now);
  delete from public.job_profile_daily_attempts where day < v_day - 2;

  select * into v_request from public.job_profile_requests
  where user_id = p_user_id and content_hash = p_content_hash and version = p_version
  for update;

  if found then
    if v_request.status = 'succeeded' then
      return jsonb_build_object('state', 'cached', 'mapping', v_request.mapping);
    end if;
    if v_request.status = 'processing' and v_request.lease_expires_at > v_now then
      return jsonb_build_object('state', 'processing');
    end if;
    if v_request.attempts >= 2 then
      return jsonb_build_object('state', 'unavailable');
    end if;
  end if;

  insert into public.job_profile_daily_attempts(day, scope, attempts)
  values (v_day, 'global', 0), (v_day, v_user_scope, 0)
  on conflict do nothing;

  select attempts into v_global_attempts from public.job_profile_daily_attempts
  where day = v_day and scope = 'global';
  select attempts into v_user_attempts from public.job_profile_daily_attempts
  where day = v_day and scope = v_user_scope;

  if v_global_attempts >= p_global_daily_limit or v_user_attempts >= p_user_daily_limit then
    return jsonb_build_object('state', 'rate_limited');
  end if;

  v_lease_id := gen_random_uuid();

  insert into public.job_profile_requests (
    user_id, content_hash, version, status, attempts, lease_id,
    lease_expires_at, expires_at, created_at, updated_at
  ) values (
    p_user_id, p_content_hash, p_version, 'processing', 1, v_lease_id,
    v_now + interval '60 seconds', v_now + interval '24 hours', v_now, v_now
  )
  on conflict (user_id, content_hash, version) do update set
    status = 'processing',
    attempts = job_profile_requests.attempts + 1,
    lease_id = v_lease_id,
    lease_expires_at = v_now + interval '60 seconds',
    mapping = null,
    updated_at = v_now;

  update public.job_profile_daily_attempts set attempts = attempts + 1
  where day = v_day and scope in ('global', v_user_scope);

  return jsonb_build_object('state', 'reserved', 'leaseId', v_lease_id);
end;
$$;

create function public.finish_job_profile(
  p_user_id uuid,
  p_content_hash text,
  p_version smallint,
  p_lease_id uuid,
  p_mapping jsonb default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_updated integer;
begin
  if p_mapping is not null and (
    jsonb_typeof(p_mapping) <> 'object' or octet_length(p_mapping::text) > 64000
  ) then
    raise exception 'invalid import mapping';
  end if;

  update public.job_profile_requests set
    status = case when p_mapping is null then 'failed' else 'succeeded' end,
    mapping = p_mapping,
    lease_id = null,
    lease_expires_at = null,
    expires_at = case when p_mapping is null then expires_at else v_now + interval '24 hours' end,
    updated_at = v_now
  where user_id = p_user_id and content_hash = p_content_hash and version = p_version
    and status = 'processing' and lease_id = p_lease_id and lease_expires_at > v_now;

  get diagnostics v_updated = row_count;

  return v_updated = 1;
end;
$$;

revoke all on function public.reserve_job_profile(uuid, text, smallint, integer, integer)
  from public, anon, authenticated;
revoke all on function public.finish_job_profile(uuid, text, smallint, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.reserve_job_profile(uuid, text, smallint, integer, integer)
  to service_role;
grant execute on function public.finish_job_profile(uuid, text, smallint, uuid, jsonb)
  to service_role;





