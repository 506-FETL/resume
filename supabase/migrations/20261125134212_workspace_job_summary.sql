create function public.get_workspace_job_summary(
  p_owner_id uuid, p_today date, p_stale_before timestamptz, p_week_start date
)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with jobs as materialized (
    select j.id, j.company, j.position, j.status, j.updated_at, j.focused_at,
      j.next_action_date, j.next_action, coalesce(j.archived, false) as archived,
      not coalesce(j.archived, false) and j.status not in ('offer', 'rejected') and
        case when j.next_action_date is not null then j.next_action_date <= p_today
          -- 浏览器按毫秒计算停留天数，阈值所在毫秒内的微秒部分同样算满七天。
          else coalesce(j.updated_at, 'epoch'::timestamptz) < p_stale_before + interval '1 millisecond'
        end as pending
    from public.company j
    where j.user_id = p_owner_id and j.user_id = (select auth.uid())
  ),
  -- 每个岗位最多一条正式投递。历史待确认记录、岗位状态和最后编辑时间都不能代替这条事实。
  submissions as (
    select s.submitted_on
    from public.job_submissions s
    join jobs j on j.id = s.job_id
    where s.user_id = p_owner_id and s.is_primary
  ),
  stage_counts as (
    select status, count(*) as n from jobs where not archived group by status
  ),
  pending_jobs as (
    select * from jobs where pending
  ),
  focused_jobs as (
    select * from jobs where focused_at is not null and not archived and status not in ('offer', 'rejected')
  ),
  next_interview as (
    select j.id as job_id, j.company, j.position, r.item->>'id' as round_id,
      r.item->>'label' as label, r.item->>'start_date' as start_date
    from public.company j
    cross join lateral jsonb_array_elements(nullif(j.interview_sub_stages, 'null'::jsonb))
      with ordinality as r(item, position)
    where j.user_id = p_owner_id and j.user_id = (select auth.uid())
      and not coalesce(j.archived, false) and j.status not in ('offer', 'rejected')
      and coalesce(r.item->'is_history', 'false'::jsonb) in ('false'::jsonb, 'null'::jsonb)
      and coalesce(r.item->>'status', '') not in ('已完成', '已拒绝')
      and r.item->>'start_date' >= to_char(p_today, 'YYYY-MM-DD')
      and r.item->>'start_date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and pg_input_is_valid(r.item->>'start_date', 'date')
    order by r.item->>'start_date',
      case when jsonb_typeof(r.item->'order') = 'number' then (r.item->>'order')::numeric end,
      j.updated_at desc, j.id desc, r.position
    limit 1
  ),
  weekly as (
    select submitted_on, count(*) as n from submissions
    where submitted_on >= p_week_start and submitted_on < p_week_start + 7
    group by submitted_on
  )
  select jsonb_build_object(
    'total', (select count(*) from jobs),
    'applied', (select count(*) from submissions),
    'stages', coalesce((select jsonb_object_agg(status, n) from stage_counts), '{}'::jsonb),
    'pending', (select count(*) from pending_jobs),
    'firstPendingId', (select id from pending_jobs order by updated_at desc, id desc limit 1),
    'focusedCount', (select count(*) from focused_jobs),
    'followUps', array(
      select jsonb_build_object('id', id, 'company', company, 'position', position,
        'next_action_date', next_action_date, 'next_action', next_action)
      from pending_jobs order by next_action_date asc nulls last, updated_at desc, id desc limit 2
    ),
    'focused', array(
      select jsonb_build_object('id', id, 'company', company, 'position', position,
        'status', status, 'next_action_date', next_action_date, 'next_action', next_action)
      from focused_jobs order by focused_at desc, updated_at desc, id desc limit 2
    ),
    'nextInterview', (select to_jsonb(i) from next_interview i),
    'recent', array(
      select jsonb_build_object('id', id, 'company', company, 'position', position,
        'updated_at', updated_at)
      from jobs where updated_at is not null order by updated_at desc, id desc limit 5
    ),
    'weeklyApplies', array(
      select coalesce(weekly.n, 0) from generate_series(0, 6) as d(day_offset)
      left join weekly on weekly.submitted_on = p_week_start + d.day_offset order by d.day_offset
    )
  );
$$;

revoke all on function public.get_workspace_job_summary(uuid, date, timestamptz, date)
  from public, anon, authenticated, service_role;
grant execute on function public.get_workspace_job_summary(uuid, date, timestamptz, date)
  to authenticated;
