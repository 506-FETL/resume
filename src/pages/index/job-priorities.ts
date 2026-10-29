import type { JobApplicationSummary } from '@/lib/supabase/resume/company'
import { jobContextUrl } from '@/lib/job-context'
import { APPLICATION_STATUS_CONFIG } from '@/pages/tracker/const'
import { getDaysUntil, isJobPendingFollowUp } from '@/pages/tracker/utils'

export interface JobPriorityItem {
  id: string
  title: string
  detail: string
  to: string
}

function jobTitle(job: { company: string; position: string }) {
  return [job.company || '未命名公司', job.position || '未填写职位'].join(' · ')
}

export function buildJobPriorities(jobs: JobApplicationSummary[]) {
  const followUps = jobs
    .filter(isJobPendingFollowUp)
    .sort(
      (left, right) =>
        (getDaysUntil(left.next_action_date) ?? Number.MAX_SAFE_INTEGER) -
        (getDaysUntil(right.next_action_date) ?? Number.MAX_SAFE_INTEGER),
    )
    .map(
      (job): JobPriorityItem => ({
        id: job.id,
        title: jobTitle(job),
        detail: [job.next_action_date || '长时间未推进', job.next_action]
          .filter(Boolean)
          .join(' · '),
        to: jobContextUrl('/tracker', job.id, { tab: 'follow-up' }),
      }),
    )

  const interviews = jobs
    .filter(
      (job) =>
        !job.archived && job.status !== 'offer' && job.status !== 'rejected',
    )
    .flatMap((job) =>
      job.interview_sub_stages
        .filter(
          (round) =>
            !round.is_history &&
            round.status !== '已完成' &&
            round.status !== '已拒绝' &&
            round.start_date &&
            (getDaysUntil(round.start_date) ?? -1) >= 0,
        )
        .map((round) => ({ job, round })),
    )
    .sort(
      (left, right) =>
        left.round.start_date!.localeCompare(right.round.start_date!) ||
        left.round.order - right.round.order,
    )
    .slice(0, 1)
    .map(
      ({ job, round }): JobPriorityItem => ({
        id: round.id,
        title: jobTitle(job),
        detail: `${round.start_date} · ${round.label}`,
        to: jobContextUrl('/tracker', job.id, { tab: 'interview' }),
      }),
    )

  const focused = jobs
    .filter(
      (job) =>
        job.focused_at &&
        !job.archived &&
        job.status !== 'offer' &&
        job.status !== 'rejected',
    )
    .sort((left, right) => right.focused_at!.localeCompare(left.focused_at!))
    .map(
      (job): JobPriorityItem => ({
        id: job.id,
        title: jobTitle(job),
        detail: [
          APPLICATION_STATUS_CONFIG[job.status].label,
          job.next_action_date,
          job.next_action,
        ]
          .filter(Boolean)
          .join(' · '),
        to: jobContextUrl('/tracker', job.id, { tab: 'follow-up' }),
      }),
    )

  return { interviews, followUps, focused }
}
