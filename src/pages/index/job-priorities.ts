import { jobContextUrl } from '@/lib/job-context-url'
import { APPLICATION_STATUS_CONFIG } from '@/pages/tracker/const'
import type { DashboardJobs } from './hooks/dashboard-insights/jobs'

export interface JobPriorityItem {
  id: string
  title: string
  detail: string
  to: string
}

function jobTitle(job: { company: string; position: string }) {
  return [job.company || '未命名公司', job.position || '未填写职位'].join(' · ')
}

export function buildJobPriorities(jobs: DashboardJobs) {
  const followUps = jobs.followUps.map(
    (job): JobPriorityItem => ({
      id: job.id,
      title: jobTitle(job),
      detail: [job.next_action_date || '长时间未推进', job.next_action]
        .filter(Boolean)
        .join(' · '),
      to: jobContextUrl('/tracker', job.id, { tab: 'follow-up' }),
    }),
  )

  const round = jobs.nextInterview

  const interviews: JobPriorityItem[] = round
    ? [
        {
          id: round.round_id,
          title: jobTitle(round),
          detail: `${round.start_date} · ${round.label}`,
          to: jobContextUrl('/tracker', round.job_id, { tab: 'interview' }),
        },
      ]
    : []

  const focused = jobs.focused.map(
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
