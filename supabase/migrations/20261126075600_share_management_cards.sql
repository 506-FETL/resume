-- 分组计数属于正在显示的卡片；状态计数与页码无关。
create function public.get_share_management_cards(
  p_keyword text, p_resume_ids uuid[], p_status text, p_page integer
) returns setof jsonb
language sql stable security invoker set search_path = ''
as $$
  with page_keys as materialized (
    select e.id, e.resume_id, count(*) over () as filtered_total,
      count(*) over (partition by e.resume_id) as group_count,
      first_value(e.created_at) over priority as group_time,
      first_value(e.id) over priority as group_head, e.created_at as link_time
    from private.share_management_matches(p_keyword, p_resume_ids) e
    where p_status = 'all' or e.share_status = p_status
    window priority as (partition by e.resume_id order by e.created_at desc, e.id desc)
    order by group_time desc, group_head desc, link_time desc, e.id desc
    limit 20 offset ((greatest(1, p_page)::bigint - 1) * 20)
  )
  select jsonb_build_object(
    'id', s.id, 'resume_id', s.resume_id, 'user_id', s.user_id, 'token', s.token,
    'label', s.label, 'is_active', s.is_active, 'has_password', s.has_password,
    'expires_at', s.expires_at, 'view_count', s.view_count, 'last_viewed_at', s.last_viewed_at,
    'created_at', s.created_at, 'updated_at', s.updated_at, 'current_release_id', s.current_release_id,
    'allow_comments', s.allow_comments, 'purpose', s.purpose, 'show_phone', s.show_phone,
    'show_email', s.show_email, 'archived_at', s.archived_at, 'version_id', s.version_id,
    'version', jsonb_build_object('id', v.id, 'document_revision', v.document_revision),
    'current_release', jsonb_build_object('id', r.id, 'release_no', r.release_no,
      'display_name', r.display_name, 'source_kind', r.source_kind, 'source_version_id', r.source_version_id,
      'source_version_no', r.source_version_no, 'source_version_label', r.source_version_label,
      'source_version_created_at', r.source_version_created_at, 'created_at', r.created_at),
    'group_title', c.display_name, 'group_count', k.group_count, 'filtered_total', k.filtered_total
  )
  from page_keys k
  join public.resume_shares s on s.id = k.id
  left join public.resume_config c on c.resume_id = k.resume_id and c.user_id = s.user_id
  join public.resume_config_versions v on v.id = s.version_id
  join public.resume_share_releases r on r.id = s.current_release_id
  order by k.group_time desc, k.group_head desc, k.link_time desc, k.id desc;
$$;

create function public.get_share_management_summary(p_keyword text, p_resume_ids uuid[])
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'hasResumes', case when count(*) > 0 then true else exists (
      select 1 from public.resume_config c where c.user_id = (select auth.uid())
    ) end,
    'overview', jsonb_build_object('total', count(*), 'active', count(*) filter (where share_status = 'active'),
      'views', coalesce(sum(view_count), 0)),
    'nextExpiry', min(expires_at) filter (where archived_at is null and expires_at >= now()),
    'counts', jsonb_build_object('all', count(*) filter (where matches),
      'active', count(*) filter (where matches and share_status = 'active'),
      'inactive', count(*) filter (where matches and share_status = 'inactive'),
      'expired', count(*) filter (where matches and share_status = 'expired'),
      'archived', count(*) filter (where matches and share_status = 'archived'))
  )
  from (
    select e.share_status, e.view_count, e.archived_at, e.expires_at,
      (coalesce(cardinality(p_resume_ids), 0) = 0 or e.resume_id = any(p_resume_ids))
        and (coalesce(trim(p_keyword), '') = ''
          or strpos(lower(e.label), lower(trim(p_keyword))) > 0
          or strpos(lower(e.release_name), lower(trim(p_keyword))) > 0
          or strpos(lower(e.token), lower(trim(p_keyword))) > 0) as matches
    from public.share_management_entries e
  ) scoped;
$$;

revoke all on function public.get_share_management_cards(text,uuid[],text,integer),
  public.get_share_management_summary(text,uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.get_share_management_cards(text,uuid[],text,integer),
  public.get_share_management_summary(text,uuid[]) to authenticated;
