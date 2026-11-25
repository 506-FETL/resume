-- 使用显式列保留分享表原有列授权，页面查询可继续按外键嵌入版本与发布批次。
create view public.share_management_entries with (security_invoker = true) as
select s.id, s.resume_id, s.user_id, s.token, s.label, s.is_active,
  s.has_password, s.expires_at, s.view_count, s.last_viewed_at, s.created_at,
  s.updated_at, s.current_release_id, s.allow_comments, s.purpose,
  s.show_phone, s.show_email, s.archived_at, s.version_id,
  r.display_name as release_name,
  case when s.archived_at is not null then 'archived'
    when s.expires_at < now() then 'expired'
    when s.is_active then 'active' else 'inactive' end as share_status
from public.resume_shares s
left join public.resume_share_releases r on r.id = s.current_release_id
where s.user_id = (select auth.uid()) and s.current_release_id is not null;

revoke all on public.share_management_entries from public, anon, authenticated, service_role;
grant select on public.share_management_entries to authenticated;

create function private.share_management_matches(p_keyword text, p_resume_ids uuid[])
returns setof public.share_management_entries language sql stable security invoker set search_path = ''
as $$
  select e.* from public.share_management_entries e
  where (coalesce(cardinality(p_resume_ids), 0) = 0 or e.resume_id = any(p_resume_ids))
    and (coalesce(trim(p_keyword), '') = ''
      or strpos(lower(e.label), lower(trim(p_keyword))) > 0
      or strpos(lower(e.release_name), lower(trim(p_keyword))) > 0
      or strpos(lower(e.token), lower(trim(p_keyword))) > 0);
$$;

create function private.share_management_page_keys(p_keyword text, p_resume_ids uuid[], p_status text, p_page integer)
returns table (share_id uuid, group_id uuid, group_count bigint, group_time timestamptz, group_head uuid, link_time timestamptz)
language sql stable security invoker set search_path = ''
as $$
  select e.id, e.resume_id, count(*) over (partition by e.resume_id),
    first_value(e.created_at) over priority as group_time,
    first_value(e.id) over priority as group_head, e.created_at as link_time
  from private.share_management_matches(p_keyword, p_resume_ids) e
  where p_status = 'all' or e.share_status = p_status
  window priority as (partition by e.resume_id order by e.created_at desc, e.id desc)
  order by group_time desc, group_head desc, link_time desc, e.id desc
  limit 20 offset ((greatest(1, p_page)::bigint - 1) * 20);
$$;

create function public.get_share_management_page(p_keyword text, p_resume_ids uuid[], p_status text, p_page integer)
returns setof public.share_management_entries language sql stable security invoker set search_path = ''
as $$
  select e.*
  from private.share_management_page_keys(p_keyword, p_resume_ids, p_status, p_page) k
  join public.share_management_entries e on e.id = k.share_id
  order by k.group_time desc, k.group_head desc, k.link_time desc, k.share_id desc;
$$;

create function public.get_share_management_counts(p_keyword text, p_resume_ids uuid[], p_status text, p_page integer)
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'overview', jsonb_build_object('total', totals.total, 'active', totals.active, 'views', totals.views),
    'nextExpiry', totals.next_expiry,
    'counts', to_jsonb(counts),
    'groups', coalesce((
      select jsonb_object_agg(g.group_id, g.group_count) from (
        select distinct k.group_id, k.group_count
        from private.share_management_page_keys(p_keyword, p_resume_ids, p_status, p_page) k
      ) g
    ), '{}'::jsonb)
  )
  from (
    select count(*) as total, count(*) filter (where e.share_status = 'active') as active,
      coalesce(sum(e.view_count), 0) as views,
      min(e.expires_at) filter (where e.archived_at is null and e.expires_at >= now()) as next_expiry
    from public.share_management_entries e
  ) totals
  cross join (
    select count(*) as "all", count(*) filter (where e.share_status = 'active') as active,
      count(*) filter (where e.share_status = 'inactive') as inactive,
      count(*) filter (where e.share_status = 'expired') as expired,
      count(*) filter (where e.share_status = 'archived') as archived
    from private.share_management_matches(p_keyword, p_resume_ids) e
  ) counts;
$$;

revoke all on function private.share_management_matches(text,uuid[]),
  private.share_management_page_keys(text,uuid[],text,integer),
  public.get_share_management_page(text,uuid[],text,integer),
  public.get_share_management_counts(text,uuid[],text,integer) from public, anon, authenticated, service_role;
grant execute on function private.share_management_matches(text,uuid[]),
  private.share_management_page_keys(text,uuid[],text,integer),
  public.get_share_management_page(text,uuid[],text,integer),
  public.get_share_management_counts(text,uuid[],text,integer) to authenticated;
