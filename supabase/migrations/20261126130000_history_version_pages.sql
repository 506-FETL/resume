-- A frozen timeline page and its exact matching count share the same statement snapshot.
create function public.list_history_version_page(
  p_resume_id uuid, p_keyword text, p_source text, p_milestone_only boolean,
  p_oldest_first boolean, p_page integer
) returns jsonb language sql stable security invoker set search_path = ''
as $$
  with matches as not materialized (
    select v.id, v.version_no, v.version_name, v.description, v.milestone_name,
      v.source_type, v.tags, v.created_at, v.company_id, v.submitted_at,
      v.projection_reference_date
    from public.resume_config_versions v
    where v.user_id = (select auth.uid()) and v.resume_id = p_resume_id
      and v.status = 'frozen'
      and (p_source = 'all' or v.source_type = p_source)
      and (not p_milestone_only or nullif(btrim(v.milestone_name), '') is not null)
      and (p_keyword = '' or strpos(lower(concat_ws(E'\n',
        coalesce(nullif(btrim(v.version_name), ''), '版本 V' || v.version_no),
        coalesce(v.description, ''), coalesce(v.milestone_name, ''),
        (select string_agg(btrim(tag), E'\n' order by pos)
         from jsonb_array_elements_text(v.tags) with ordinality as tag_items(tag,pos)
         where btrim(tag) <> '')
      )), lower(p_keyword)) > 0)
  ), page as (
    select m.* from matches m
    order by case when p_oldest_first then m.version_no end asc, m.version_no desc
    limit 10 offset (greatest(p_page, 0)::bigint * 10)
  )
  select jsonb_build_object(
    'total', (select count(*) from matches),
    'latest', (select jsonb_build_object('id', v.id, 'version_no', v.version_no, 'content_hash', v.content_hash)
      from public.resume_config_versions v where v.user_id = (select auth.uid())
        and v.resume_id = p_resume_id and v.status = 'frozen' order by v.version_no desc limit 1),
    'items', coalesce((select jsonb_agg(to_jsonb(p) order by
      case when p_oldest_first then p.version_no end asc, p.version_no desc)
      from page p), '[]'::jsonb)
  )
$$;

revoke all on function public.list_history_version_page(uuid,text,text,boolean,boolean,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.list_history_version_page(uuid,text,text,boolean,boolean,integer)
  to authenticated;
