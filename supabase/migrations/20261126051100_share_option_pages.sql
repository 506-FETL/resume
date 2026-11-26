create function public.get_share_resume_options(p_keyword text, p_offset integer)
returns table(resume_id uuid, display_name text)
language sql stable security invoker set search_path = ''
as $$
  select r.resume_id, coalesce(nullif(r.display_name, ''), '未命名简历') as display_name
  from public.resume_config r
  where r.user_id = (select auth.uid())
    and (
      p_keyword = ''
      or strpos(lower(coalesce(nullif(r.display_name, ''), '未命名简历')), lower(p_keyword)) > 0
      or strpos(r.resume_id::text, lower(p_keyword)) > 0
    )
  order by coalesce(nullif(r.display_name, ''), '未命名简历'), r.resume_id
  offset greatest(0, p_offset)
  limit 21
$$;

create function public.get_share_version_options(p_resume_id uuid, p_keyword text, p_offset integer)
returns table(id bigint, version_no integer, version_name text, milestone_name text, created_at timestamptz)
language sql stable security invoker set search_path = ''
as $$
  select v.id, v.version_no, v.version_name, v.milestone_name, v.created_at
  from public.resume_config_versions v
  where v.user_id = (select auth.uid())
    and v.resume_id = p_resume_id
    and v.status = 'frozen'
    and (
      p_keyword = ''
      or strpos(lower(
        'V' || v.version_no::text || ' ' ||
        coalesce(nullif(trim(v.version_name), ''), nullif(trim(v.milestone_name), ''), '未命名版本') ||
        ' ' || coalesce(v.version_name, '') || ' ' || coalesce(v.milestone_name, '')
      ), lower(p_keyword)) > 0
    )
  order by v.version_no desc
  offset greatest(0, p_offset)
  limit 21
$$;

revoke all on function public.get_share_resume_options(text,integer),
  public.get_share_version_options(uuid,text,integer) from public, anon, authenticated, service_role;
grant execute on function public.get_share_resume_options(text,integer),
  public.get_share_version_options(uuid,text,integer) to authenticated;
