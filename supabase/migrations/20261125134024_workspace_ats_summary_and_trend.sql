-- 旧接口先分页再计算待处理项，首页概况汇总该账户的全部最新报告。
create function private.dashboard_ats_assessment_rows(
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
    limit p_limit offset p_offset
  ) as report
  order by report.resume_id;
$$;

revoke all on function private.dashboard_ats_assessment_rows(uuid, integer, integer, text[], text[])
  from public, anon, authenticated, service_role;
grant execute on function private.dashboard_ats_assessment_rows(uuid, integer, integer, text[], text[])
  to authenticated;

create or replace function public.get_dashboard_ats_assessments(
  p_owner_id uuid, p_offset integer, p_limit integer, p_suggestion_kinds text[], p_value_types text[]
)
returns table(resume_id uuid, overall_score jsonb, pending_count bigint)
language sql stable security invoker set search_path = ''
as $$
  select * from private.dashboard_ats_assessment_rows(
    p_owner_id, p_offset, least(p_limit, 500), p_suggestion_kinds, p_value_types
  );
$$;

create function public.get_dashboard_ats_summary(
  p_owner_id uuid, p_suggestion_kinds text[], p_value_types text[]
)
returns table(assessed_count bigint, scored_count bigint, score_sum double precision, pending_count numeric)
language sql stable security invoker set search_path = ''
as $$
  select count(*), count(report.score),
    -- 与旧客户端按简历 ID 顺序累加的 JavaScript Number 一致，最终均分仍由 Math.round 取整。
    sum(report.score order by report.resume_id),
    coalesce(sum(report.pending_count), 0)
  from (
    select r.resume_id, r.pending_count,
      case when jsonb_typeof(r.overall_score) = 'number' then r.overall_score::double precision end as score
    from private.dashboard_ats_assessment_rows(p_owner_id, 0, null, p_suggestion_kinds, p_value_types) as r
  ) as report;
$$;

create function public.get_dashboard_ats_trend(p_owner_id uuid)
returns table(created_at timestamptz, overall_score jsonb)
language sql stable security invoker set search_path = ''
as $$
  select recent.created_at, recent.overall_score
  from (
    select a.id, a.created_at, a.summary->'overall_score' as overall_score
    from public.ats as a
    where a.user_id = p_owner_id and a.user_id = (select auth.uid())
      and jsonb_typeof(a.summary->'overall_score') = 'number'
    order by a.created_at desc, a.id desc
    limit 8
  ) as recent
  order by recent.created_at, recent.id;
$$;

revoke all on function public.get_dashboard_ats_summary(uuid, text[], text[]),
  public.get_dashboard_ats_trend(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_dashboard_ats_summary(uuid, text[], text[]),
  public.get_dashboard_ats_trend(uuid) to authenticated;
