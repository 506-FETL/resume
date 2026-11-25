create view public.dashboard_job_summaries
with (security_invoker = true)
as
select
  job.id, job.user_id, job.company, job.position, job.status, job.updated_at,
  job.archived, job.focused_at, job.next_action_date, job.next_action,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', round.item -> 'id',
      'label', round.item -> 'label',
      'status', round.item -> 'status',
      'start_date', round.item -> 'start_date',
      'order', round.item -> 'order',
      'is_history', round.item -> 'is_history'
    ) order by round.position)
    from jsonb_array_elements(nullif(job.interview_sub_stages, 'null'::jsonb)) with ordinality
      as round(item, position)
  ), '[]'::jsonb) as interview_sub_stages
from public.company as job;

revoke all on public.dashboard_job_summaries from public, anon, authenticated, service_role;
grant select on public.dashboard_job_summaries to authenticated;
