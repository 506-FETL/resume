begin;

alter table public.company add column focused_at timestamptz;
grant select(focused_at), update(focused_at) on public.company to authenticated;

create function public.update_company_business_updated_at() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.focused_at is distinct from old.focused_at
    and (to_jsonb(new) - array['focused_at','updated_at'])
      is not distinct from (to_jsonb(old) - array['focused_at','updated_at']) then
    new.updated_at := old.updated_at;
  else
    new.updated_at := now();
  end if;

  return new;
end;
$$;
revoke all on function public.update_company_business_updated_at() from public,anon,authenticated;

drop trigger update_company_updated_at on public.company;
create trigger update_company_updated_at before update on public.company
for each row execute function public.update_company_business_updated_at();

create or replace function public.save_job_submission_material(
  p_user_id uuid, p_id uuid, p_job_id uuid, p_input jsonb,
  p_material jsonb, p_supplement boolean default false, p_replace boolean default false, p_reason text default ''
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
    or (p_replace and not p_supplement)
    or (p_supplement and (not p_replace or v_kind = 'pending'
      or p_reason is null or length(trim(p_reason)) = 0 or length(p_reason) > 1000)) then
    raise exception 'invalid_submission' using errcode = '22023';
  end if;
  -- Stable lock order serializes replays, corrections and concurrent job writes.
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
    if v_row.material_kind = 'pending' then
      raise exception 'material_original_missing' using errcode = '22023';
    end if;
    if v_row.material_payload is not distinct from (p_material - 'path') then
      return to_jsonb(v_row) - array['snapshot','template_manifest','request_payload','material_payload','file_path','file_hash','jd_text'];
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


commit;

