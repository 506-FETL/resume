create function public.get_assistant_job_counts(p_owner_id uuid)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'total', coalesce(sum(grouped.n), 0),
    'statuses', coalesce(jsonb_object_agg(grouped.status, grouped.n), '{}'::jsonb)
  )
  from (
    select status, count(*) as n
    from public.company
    where user_id = p_owner_id and user_id = (select auth.uid())
    group by status
  ) as grouped;
$$;

revoke all on function public.get_assistant_job_counts(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_assistant_job_counts(uuid) to authenticated;

create function public.get_resume_comment_thread_counts(p_scope_id uuid)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'unresolved', count(*) filter (where anchor_status <> 'detached' and resolved_at is null),
    'resolved', count(*) filter (where anchor_status <> 'detached' and resolved_at is not null),
    'detached', count(*) filter (where anchor_status = 'detached')
  )
  from public.resume_comment_threads
  where scope_id = p_scope_id and deleted_at is null;
$$;

revoke all on function public.get_resume_comment_thread_counts(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_resume_comment_thread_counts(uuid) to service_role;

-- 午夜边界来自浏览器的本地时区。夏令时切换日的长度可以不是 24 小时。
create function public.get_dashboard_version_edits(p_owner_id uuid, p_day_starts timestamptz[])
returns bigint[]
language sql stable security invoker set search_path = ''
as $$
  with edits as (
    select width_bucket(v.created_at, p_day_starts) as day, count(*) as n
    from public.resume_config_versions as v
    join public.resume_config as r on r.resume_id = v.resume_id and r.user_id = v.user_id
    where v.user_id = p_owner_id and v.user_id = (select auth.uid())
      and v.created_at >= p_day_starts[1] and v.created_at < p_day_starts[8]
    group by 1
  )
  select array(
    select coalesce(edits.n, 0)
    from generate_series(1, 7) as days(day)
    left join edits using (day)
    order by days.day
  );
$$;

revoke all on function public.get_dashboard_version_edits(uuid, timestamptz[])
  from public, anon, authenticated, service_role;
grant execute on function public.get_dashboard_version_edits(uuid, timestamptz[]) to authenticated;
