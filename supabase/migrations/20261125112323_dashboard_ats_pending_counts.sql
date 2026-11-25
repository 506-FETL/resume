-- 与 String.trim() 相同的空白字符，历史报告的 ID、标题及定位路径沿用原判定。
create function private.ats_nonempty_text(p_value jsonb)
returns text language sql immutable strict parallel safe security invoker set search_path = ''
as $$
  select case when jsonb_typeof(p_value) = 'string' then
    nullif(btrim(p_value #>> '{}',
      U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'
    ), '')
  end;
$$;

revoke all on function private.ats_nonempty_text(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function private.ats_nonempty_text(jsonb) to authenticated;

-- 先选定可见的本页最新报告，再根据持久化修复建议或旧版同路径证据计数。
create function public.get_dashboard_ats_assessments(
  p_owner_id uuid, p_offset integer, p_limit integer, p_suggestion_kinds text[], p_value_types text[]
)
returns table(resume_id uuid, overall_score jsonb, pending_count bigint)
language sql stable security invoker set search_path = ''
as $$
  select report.resume_id, report.overall_score, (
    select count(*)
    from (values (report.findings->'high'), (report.findings->'medium'), (report.findings->'low')) as severity(items)
    cross join lateral jsonb_path_query(severity.items, 'strict $[*]', '{}', true) as f(item)
    cross join lateral (
      select count(*) as valid_count,
        bool_or((s.item->'fixed') is distinct from 'true'::jsonb) as has_pending
      from jsonb_path_query(f.item #> '{fix,suggestions}', 'strict $[*]', '{}', true) as s(item)
      where jsonb_typeof(s.item) = 'object' and s.item ? 'after'
        and s.item->>'kind' = any(p_suggestion_kinds)
        and s.item->>'valueType' = any(p_value_types)
        and private.ats_nonempty_text(s.item #> '{locate,path}') is not null
    ) as suggestions
    where jsonb_typeof(f.item->'fix') = 'object'
      and jsonb_typeof(f.item #> '{why,evidence}') = 'array'
      and private.ats_nonempty_text(f.item->'id') is not null
      and private.ats_nonempty_text(f.item->'title') is not null
      and private.ats_nonempty_text(f.item #> '{locate,path}') is not null
      and case when suggestions.valid_count > 0 then suggestions.has_pending
        else exists (
          select 1
          from jsonb_path_query(f.item #> '{why,evidence}', 'strict $[*]', '{}', true) as e(item)
          where jsonb_typeof(e.item) = 'object' and e.item ? 'rawValue'
            and private.ats_nonempty_text(e.item #> '{locate,path}') =
              private.ats_nonempty_text(f.item #> '{locate,path}')
        )
      end
  ) as pending_count
  from (
    select r.resume_id, r.overall_score, r.findings
    from public.latest_ats_reports as r
    where r.user_id = p_owner_id and r.user_id = (select auth.uid())
    order by r.resume_id
    limit least(p_limit, 500) offset p_offset
  ) as report
  order by report.resume_id;
$$;

revoke all on function public.get_dashboard_ats_assessments(uuid, integer, integer, text[], text[])
  from public, anon, authenticated, service_role;
grant execute on function public.get_dashboard_ats_assessments(uuid, integer, integer, text[], text[])
  to authenticated;
