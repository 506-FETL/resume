create table public.tracker_companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  logo text,
  process_policy text not null default 'unknown'
    check (process_policy in ('unknown','single_active','multiple_active')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id,user_id)
);
alter table public.tracker_companies enable row level security;
revoke all on public.tracker_companies from public,anon,authenticated;
grant select on public.tracker_companies to authenticated;
grant all on public.tracker_companies to service_role;
create policy tracker_company_owner_read on public.tracker_companies
  for select to authenticated using (user_id=(select auth.uid()));

alter table public.company
  add column tracker_company_id uuid,
  add column recruitment_batch text check (length(recruitment_batch)<=200),
  add column referred_from_job_id uuid references public.company(id) on delete set null;

-- Each old process retains its own identity until its owner chooses a company.
insert into public.tracker_companies(id,user_id,name,logo)
select id,user_id,company,company_logo from public.company;
alter table public.company disable trigger update_company_updated_at;
update public.company set tracker_company_id=id;
alter table public.company enable trigger update_company_updated_at;
alter table public.company alter column tracker_company_id set not null;
alter table public.company add constraint company_tracker_owner_fk
  foreign key (tracker_company_id,user_id) references public.tracker_companies(id,user_id);
create index company_tracker_owner on public.company(tracker_company_id,user_id);
create index company_referral on public.company(referred_from_job_id)
  where referred_from_job_id is not null;

alter table public.job_submissions add column is_primary boolean not null default false;
update public.job_submissions s set is_primary=true
where (select count(*) from public.job_submissions x where x.job_id=s.job_id)=1;
create unique index job_submissions_one_primary_per_job on public.job_submissions(job_id) where is_primary;
grant select(is_primary) on public.job_submissions to authenticated;

create table public.job_submission_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  submission_id uuid not null references public.job_submissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  reason text not null check (length(btrim(reason)) between 1 and 1000),
  before_snapshot jsonb not null
);
create index job_submission_revision_history on public.job_submission_revisions(submission_id,created_at desc);
alter table public.job_submission_revisions enable row level security;
revoke all on public.job_submission_revisions from public,anon,authenticated;
grant select(id,user_id,submission_id,created_at,reason) on public.job_submission_revisions to authenticated;
grant all on public.job_submission_revisions to service_role;
create policy submission_revision_owner_read on public.job_submission_revisions for select to authenticated
using (user_id=(select auth.uid()) and exists (
  select 1 from public.job_submissions s where s.id=submission_id and s.user_id=(select auth.uid())
));

create function public.assert_tracker_company_capacity(p_company_id uuid,p_job_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_policy text; v_conflict uuid;
begin
  select process_policy into v_policy from public.tracker_companies where id=p_company_id for update;
  if v_policy='single_active' then
    select id into v_conflict from public.company
    where tracker_company_id=p_company_id and id is distinct from p_job_id
      and status in ('applied','assessment','screen','written','interview') limit 1;
    if found then raise exception 'active_process_conflict' using errcode='P0001',detail=v_conflict::text; end if;
  end if;
end;
$$;
revoke all on function public.assert_tracker_company_capacity(uuid,uuid) from public,anon,authenticated;

create function public.enforce_tracker_company_policy() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.process_policy='single_active' then
    perform public.assert_tracker_company_capacity(new.id,(
      select id from public.company where tracker_company_id=new.id
        and status in ('applied','assessment','screen','written','interview') order by id limit 1
    ));
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_tracker_company_policy() from public,anon,authenticated;
create trigger enforce_tracker_company_policy after update of process_policy on public.tracker_companies
for each row execute function public.enforce_tracker_company_policy();

create function public.enforce_tracker_process() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  v_company public.tracker_companies%rowtype;
  v_date date;
  v_constrained_change boolean:=tg_op='INSERT' or old.status is distinct from new.status
    or old.tracker_company_id is distinct from new.tracker_company_id;
begin
  if v_constrained_change then
    select * into v_company from public.tracker_companies where id=new.tracker_company_id and user_id=new.user_id for update;
  else
    select * into v_company from public.tracker_companies where id=new.tracker_company_id and user_id=new.user_id;
  end if;
  if not found then raise exception 'company_not_found' using errcode='42501'; end if;
  if v_constrained_change and new.status in ('applied','assessment','screen','written','interview') then
    perform public.assert_tracker_company_capacity(new.tracker_company_id,new.id);
  end if;
  if new.referred_from_job_id is not null and not exists (
    select 1 from public.company where id=new.referred_from_job_id and user_id=new.user_id
      and tracker_company_id=new.tracker_company_id and id<>new.id
  ) then raise exception 'invalid_referral' using errcode='22023'; end if;
  new.company:=v_company.name;
  new.company_logo:=v_company.logo;
  if new.status='applied' and (tg_op='INSERT' or old.status is distinct from new.status) and not exists (
    select 1 from public.job_submissions where job_id=new.id and is_primary
  ) then raise exception 'submission_required' using errcode='P0001'; end if;
  select submitted_on into v_date from public.job_submissions where job_id=new.id and is_primary;
  if found then
    select coalesce(jsonb_agg(case when d->>'stage'='applied' then d||jsonb_build_object('start_date',v_date) else d end order by ord),'[]')
    into new.stage_details from jsonb_array_elements(new.stage_details) with ordinality e(d,ord);
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_tracker_process() from public,anon,authenticated;
create trigger enforce_tracker_process before insert or update of status,tracker_company_id,stage_details,referred_from_job_id on public.company
for each row execute function public.enforce_tracker_process();

create function public.create_tracker_process(p_job jsonb) returns public.company
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_company uuid; v_row public.company%rowtype;
begin
  if v_user is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if jsonb_typeof(p_job)<>'object' or nullif(btrim(p_job->>'position'),'') is null
    or nullif(btrim(p_job->>'company'),'') is null then raise exception 'invalid_job' using errcode='22023'; end if;
  if p_job->>'resume_id' is not null and not exists (
    select 1 from public.resume_config where resume_id=(p_job->>'resume_id')::uuid and user_id=v_user
  ) then raise exception 'resume_not_found' using errcode='42501'; end if;
  v_company:=nullif(p_job->>'tracker_company_id','')::uuid;
  if v_company is null then
    insert into public.tracker_companies(user_id,name,logo) values(v_user,btrim(p_job->>'company'),p_job->>'company_logo') returning id into v_company;
  end if;
  perform 1 from public.tracker_companies where id=v_company and user_id=v_user for update;
  if not found then raise exception 'company_not_found' using errcode='42501'; end if;
  if p_job->>'status' in ('applied','assessment','screen','written','interview') then
    perform public.assert_tracker_company_capacity(v_company);
  end if;
  insert into public.company(user_id,tracker_company_id,company,position,location,resume_id,salary,job_url,status,
    stage_details,interview_sub_stages,activities,contacts,jd_text,source,recruitment_batch,referred_from_job_id)
  values(v_user,v_company,p_job->>'company',p_job->>'position',coalesce(p_job->>'location',''),
    (p_job->>'resume_id')::uuid,p_job->>'salary',p_job->>'job_url',coalesce(p_job->>'status','saved'),
    coalesce(p_job->'stage_details','[]'),coalesce(p_job->'interview_sub_stages','[]'),'[]','[]',
    p_job->>'jd_text',p_job->>'source',p_job->>'recruitment_batch',(p_job->>'referred_from_job_id')::uuid)
  returning * into v_row;
  return v_row;
end;
$$;

create function public.update_tracker_company_policy(p_company_id uuid,p_policy text) returns public.tracker_companies
language plpgsql security definer set search_path='' as $$
declare v_row public.tracker_companies%rowtype;
begin
  select * into v_row from public.tracker_companies where id=p_company_id and user_id=auth.uid() for update;
  if not found then raise exception 'company_not_found' using errcode='42501'; end if;
  update public.tracker_companies set process_policy=p_policy,updated_at=now() where id=p_company_id returning * into v_row;
  return v_row;
end;
$$;

create function public.reassign_tracker_process(p_job_id uuid,p_company_id uuid) returns public.company
language plpgsql security definer set search_path='' as $$
declare v_row public.company%rowtype;
begin
  select * into v_row from public.company where id=p_job_id and user_id=auth.uid();
  if not found then raise exception 'job_not_found' using errcode='42501'; end if;
  perform 1 from public.tracker_companies where id in (v_row.tracker_company_id,p_company_id) order by id for update;
  perform 1 from public.tracker_companies where id=p_company_id and user_id=auth.uid();
  if not found then raise exception 'company_not_found' using errcode='42501'; end if;
  if exists(select 1 from public.company where referred_from_job_id=p_job_id and tracker_company_id<>p_company_id) then
    raise exception 'referral_company_conflict' using errcode='P0001';
  end if;
  update public.company set tracker_company_id=p_company_id,updated_at=now() where id=p_job_id returning * into v_row;
  return v_row;
end;
$$;

create function public.transition_tracker_process(p_job_id uuid,p_patch jsonb) returns public.company
language plpgsql security definer set search_path='' as $$
declare v_row public.company%rowtype; v_target text:=p_patch->>'status';
begin
  select * into v_row from public.company where id=p_job_id and user_id=auth.uid();
  if not found then raise exception 'job_not_found' using errcode='42501'; end if;
  perform 1 from public.tracker_companies where id=v_row.tracker_company_id for update;
  select * into v_row from public.company where id=p_job_id for update;
  if v_row.status='rejected' and v_target in ('applied','assessment','screen','written','interview') then
    raise exception 'reopen_required' using errcode='P0001';
  end if;
  if v_target is null or jsonb_typeof(p_patch->'stage_details') is distinct from 'array'
    or jsonb_typeof(p_patch->'interview_sub_stages') is distinct from 'array' or jsonb_typeof(p_patch->'activities') is distinct from 'array' then
    raise exception 'invalid_transition' using errcode='22023';
  end if;
  update public.company set status=v_target,stage_details=p_patch->'stage_details',
    interview_sub_stages=p_patch->'interview_sub_stages',activities=p_patch->'activities',
    next_action=case when p_patch?'next_action' then p_patch->>'next_action' else next_action end,
    next_action_date=case when p_patch?'next_action_date' then (p_patch->>'next_action_date')::date else next_action_date end,
    updated_at=now() where id=p_job_id returning * into v_row;
  return v_row;
end;
$$;

create function public.reopen_tracker_process(p_job_id uuid,p_event_id uuid,p_target text,p_date date,p_reason text)
returns public.company language plpgsql security definer set search_path='' as $$
declare v_row public.company%rowtype; v_ended jsonb; v_rounds jsonb; v_stages jsonb;
begin
  select * into v_row from public.company where id=p_job_id and user_id=auth.uid();
  if not found then raise exception 'job_not_found' using errcode='42501'; end if;
  perform 1 from public.tracker_companies where id=v_row.tracker_company_id for update;
  select * into v_row from public.company where id=p_job_id for update;
  if exists(select 1 from jsonb_array_elements(v_row.activities) a where a->>'id'=p_event_id::text and a->>'type'='workflow_resume') then return v_row; end if;
  if v_row.status<>'rejected' or p_target not in ('assessment','screen','written','interview') or p_target is null
    or p_event_id is null or p_date is null or length(p_reason)>1000 then raise exception 'invalid_reopen' using errcode='22023'; end if;
  select d into v_ended from jsonb_array_elements(v_row.stage_details) d where d->>'stage'='rejected';
  select coalesce(jsonb_agg(r||'{"is_history":true}'::jsonb order by ord),'[]') into v_rounds
    from jsonb_array_elements(coalesce(v_row.interview_sub_stages,'[]')) with ordinality e(r,ord);
  if p_target='interview' then
    v_rounds:=v_rounds||jsonb_build_array(jsonb_build_object('id',p_event_id,'label','恢复面试','status','进行中',
      'start_date',p_date,'notes','','order',coalesce((select max((r->>'order')::numeric)+1 from jsonb_array_elements(v_rounds) r),0)));
  end if;
  select coalesce(jsonb_agg(case when d->>'stage'=p_target then d||jsonb_build_object('status','进行中','start_date',p_date)
    when d->>'status' in ('进行中','已拒绝') then d||'{"status":"待处理"}'::jsonb else d end order by ord),'[]') into v_stages
    from jsonb_array_elements(v_row.stage_details) with ordinality e(d,ord);
  if not exists(select 1 from jsonb_array_elements(v_stages) d where d->>'stage'=p_target) then
    v_stages:=v_stages||jsonb_build_array(jsonb_build_object('stage',p_target,'status','进行中','start_date',p_date,'notes',''));
  end if;
  update public.company set status=p_target,archived=false,stage_details=v_stages,interview_sub_stages=v_rounds,
    activities=activities||jsonb_build_array(jsonb_build_object('id',p_event_id,'type','workflow_resume','label','恢复流程','at',now(),
      'note',p_reason,'resume_details',jsonb_build_object('date',p_date,'target',p_target,'ended_detail',v_ended,
        'source_stage',v_ended->'source_stage','history_round_ids',coalesce((
          select jsonb_agg(r->'id' order by ord)
          from jsonb_array_elements(coalesce(v_row.interview_sub_stages,'[]')) with ordinality e(r,ord)
        ),'[]'::jsonb)))),updated_at=now()
  where id=p_job_id returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.create_tracker_process(jsonb), public.update_tracker_company_policy(uuid,text),
  public.reassign_tracker_process(uuid,uuid), public.transition_tracker_process(uuid,jsonb),
  public.reopen_tracker_process(uuid,uuid,text,date,text) from public,anon,authenticated;
grant execute on function public.create_tracker_process(jsonb), public.update_tracker_company_policy(uuid,text),
  public.reassign_tracker_process(uuid,uuid), public.transition_tracker_process(uuid,jsonb),
  public.reopen_tracker_process(uuid,uuid,text,date,text) to authenticated;
revoke insert,update on public.company from authenticated;
grant update(resume_id,position,location,salary,job_url,stage_details,interview_sub_stages,archived,next_action,
  next_action_date,activities,contacts,jd_text,source,recruitment_batch,updated_at) on public.company to authenticated;

create function public.submission_public_summary(p_row public.job_submissions) returns jsonb
language sql immutable set search_path='' as $$
  select to_jsonb(p_row)-array['snapshot','template_manifest','request_payload','material_payload','file_path','file_hash','jd_text'];
$$;
revoke all on function public.submission_public_summary(public.job_submissions) from public,anon,authenticated;
grant execute on function public.submission_public_summary(public.job_submissions) to service_role;

create function public.resolve_job_submission(p_user_id uuid,p_job_id uuid,p_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_row public.job_submissions%rowtype;
begin
  perform 1 from public.tracker_companies where id=(
    select tracker_company_id from public.company where id=p_job_id and user_id=p_user_id
  ) for update;
  perform 1 from public.company where id=p_job_id and user_id=p_user_id for update;
  if not found then raise exception 'job_not_found' using errcode='42501'; end if;
  if exists(select 1 from public.job_submissions where job_id=p_job_id and is_primary and id<>p_id) then
    raise exception 'submission_already_selected' using errcode='23505';
  end if;
  update public.job_submissions set is_primary=true where id=p_id and job_id=p_job_id and user_id=p_user_id returning * into v_row;
  if not found then raise exception 'submission_not_found' using errcode='42501'; end if;
  update public.company set stage_details=stage_details where id=p_job_id;
  return public.submission_public_summary(v_row);
end;
$$;
revoke all on function public.resolve_job_submission(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.resolve_job_submission(uuid,uuid,uuid) to service_role;

create function public.save_job_submission_material(
  p_user_id uuid, p_id uuid, p_job_id uuid, p_input jsonb,
  p_material jsonb, p_supplement boolean default false, p_replace boolean default false, p_reason text default '补充材料'
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
  v_existing uuid;
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
  perform 1 from public.tracker_companies where id=(select tracker_company_id from public.company where id=p_job_id and user_id=p_user_id) for update;
  select * into v_job from public.company where id = p_job_id and user_id = p_user_id for update;
  if not found then raise exception 'job_not_found' using errcode = '42501'; end if;
  select * into v_row from public.job_submissions where id = p_id for update;
  if found then
    if v_row.user_id <> p_user_id or v_row.job_id <> p_job_id then
      raise exception 'submission_not_found' using errcode = '42501';
    end if;
    if not v_row.is_primary then raise exception 'submission_needs_resolution' using errcode='23505'; end if;
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
      if not p_replace then raise exception 'material_already_saved' using errcode = '23505'; end if;
    end if;
  elsif p_supplement then
    raise exception 'submission_not_found' using errcode = '42501';
  elsif exists(select 1 from public.job_submissions where job_id=p_job_id) then
    select id into v_existing from public.job_submissions where job_id=p_job_id and is_primary;
    if found then
      raise exception 'submission_already_recorded' using errcode='23505',detail=v_existing::text;
    end if;
    raise exception 'submission_needs_resolution' using errcode='23505';
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
    insert into public.job_submission_revisions(user_id,submission_id,reason,before_snapshot)
    values(p_user_id,p_id,p_reason,to_jsonb(v_row));
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
    insert into public.job_submissions(is_primary,id,user_id,job_id,submitted_on,channel,note,jd_text,jd_updated_at,material_kind,resume_id,version_id,projection_reference_date,snapshot,template_manifest,file_path,file_name,file_mime,file_size,file_hash,request_payload,material_payload)
    values(true,p_id,p_user_id,p_job_id,(p_input ->> 'submittedOn')::date,p_input ->> 'channel',p_input ->> 'note',v_job.jd_text,v_job.jd_updated_at,v_kind,v_resume,v_version,v_projection_date,v_source,v_manifest,p_material ->> 'path',p_material ->> 'name',p_material ->> 'mime',(p_material ->> 'size')::integer,p_material ->> 'hash',jsonb_build_object('input',p_input,'material',p_material - 'path'),p_material - 'path')
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
    else
      update public.company set stage_details=stage_details where id=p_job_id;
    end if;
  end if;
  return to_jsonb(v_row) - array['snapshot','template_manifest','request_payload','material_payload','file_path','file_hash','jd_text'];
end;
$$;

revoke all on function public.save_job_submission_material(uuid,uuid,uuid,jsonb,jsonb,boolean,boolean,text) from public,anon,authenticated;
grant execute on function public.save_job_submission_material(uuid,uuid,uuid,jsonb,jsonb,boolean,boolean,text) to service_role;

create or replace function public.save_job_submission(
  p_user_id uuid,p_id uuid,p_job_id uuid,p_input jsonb,p_material jsonb,p_supplement boolean default false
) returns jsonb language sql security invoker set search_path='' as $$
  select public.save_job_submission_material(p_user_id,p_id,p_job_id,p_input,p_material,p_supplement,false,'补充材料');
$$;

create function public.update_job_submission_details(p_user_id uuid,p_id uuid,p_input jsonb,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_row public.job_submissions%rowtype;
begin
  perform 1 from public.tracker_companies where id=(select c.tracker_company_id from public.company c
    join public.job_submissions s on s.job_id=c.id where s.id=p_id and c.user_id=p_user_id) for update;
  perform 1 from public.company where id=(select job_id from public.job_submissions where id=p_id and user_id=p_user_id) for update;
  select * into v_row from public.job_submissions where id=p_id and user_id=p_user_id and is_primary for update;
  if not found then raise exception 'submission_not_found' using errcode='42501'; end if;
  if v_row.submitted_on is not distinct from (p_input->>'submittedOn')::date
    and v_row.channel is not distinct from p_input->>'channel' and v_row.note is not distinct from p_input->>'note' then
    return public.submission_public_summary(v_row);
  end if;
  insert into public.job_submission_revisions(user_id,submission_id,reason,before_snapshot)
  values(p_user_id,p_id,p_reason,to_jsonb(v_row));
  update public.job_submissions set submitted_on=(p_input->>'submittedOn')::date,channel=p_input->>'channel',note=p_input->>'note'
    where id=p_id returning * into v_row;
  update public.company set stage_details=stage_details,updated_at=now() where id=v_row.job_id;
  return public.submission_public_summary(v_row);
end;
$$;
revoke all on function public.update_job_submission_details(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.update_job_submission_details(uuid,uuid,jsonb,text) to service_role;
