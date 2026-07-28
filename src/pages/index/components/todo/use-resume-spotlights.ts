import type { Resume } from '../../types'
import type { ResumeVersionSourceType } from '@/lib/supabase/resume/history'
import type { ApplicationStatus } from '@/pages/tracker/types'
import { useEffect, useMemo, useState } from 'react'
import { listAtsSummaries, listJobApplicationSummaries, listResumeHistoryVersionSummaries } from '@/lib/supabase/resume'
import { isJobPendingFollowUp } from '@/pages/tracker/utils'
import { diffDates } from '@/utils/date'

export interface ResumeSpotlight {
  resume: Resume
  version: {
    count: number
    latestVersionNo: number | null
    latestVersionAt: string | null
    latestSource: ResumeVersionSourceType | null
    hasMilestone: boolean
  }
  tracker: {
    jobCount: number
    pendingCount: number
    activeCount: number
    interviewCount: number
    offerCount: number
    rejectedCount: number
    latestJob: {
      company: string
      position: string
      updatedAt: string
      status: ApplicationStatus
    } | null
    headline: string
    detail: string
  }
  ats: {
    checkedAt: string | null
    score: number | null
    todoCount: number
    todoItems: string[]
    hasReport: boolean
  }
}

export function useResumeSpotlights(resumes: Resume[], resumesLoading: boolean) {
  const onlineResumes = useMemo(
    () => resumes.filter(resume => !resume.isOffline),
    [resumes],
  )
  const [items, setItems] = useState<ResumeSpotlight[]>([])
  const [loading, setLoading] = useState(true)

  const resumeIdsKey = useMemo(
    () => onlineResumes.map(resume => resume.resume_id).join(','),
    [onlineResumes],
  )

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (resumesLoading) {
        setLoading(true)
        return
      }

      if (onlineResumes.length === 0) {
        if (!cancelled) {
          setItems([])
          setLoading(false)
        }
        return
      }

      setLoading(true)

      try {
        const [versionSummaries, jobSummaries, atsSummaries] = await Promise.all([
          listResumeHistoryVersionSummaries(),
          listJobApplicationSummaries(),
          listAtsSummaries(),
        ])

        if (cancelled) {
          return
        }

        const versionMap = new Map<string, typeof versionSummaries>()
        for (const summary of versionSummaries) {
          const existing = versionMap.get(summary.resume_id)
          if (existing) {
            existing.push(summary)
          }
          else {
            versionMap.set(summary.resume_id, [summary])
          }
        }

        const jobMap = new Map<string, typeof jobSummaries>()
        for (const summary of jobSummaries) {
          if (!summary.resume_id) {
            continue
          }

          const existing = jobMap.get(summary.resume_id)
          if (existing) {
            existing.push(summary)
          }
          else {
            jobMap.set(summary.resume_id, [summary])
          }
        }

        const atsMap = new Map<string, (typeof atsSummaries)[number]>()
        for (const summary of atsSummaries) {
          const existing = atsMap.get(summary.resume_id)
          if (!existing || diffDates(summary.created_at, existing.created_at) > 0) {
            atsMap.set(summary.resume_id, summary)
          }
        }

        const nextItems = onlineResumes
          .map((resume) => {
            const versionEntries = versionMap.get(resume.resume_id) ?? []
            const latestVersion = versionEntries[0] ?? null
            const jobs = (jobMap.get(resume.resume_id) ?? []).sort((a, b) => diffDates(b.updated_at, a.updated_at))
            const latestJob = jobs[0] ?? null
            const ats = atsMap.get(resume.resume_id) ?? null

            const statusCounts = jobs.reduce<Record<ApplicationStatus, number>>((accumulator, job) => {
              accumulator[job.status] += 1
              return accumulator
            }, {
              saved: 0,
              applied: 0,
              screen: 0,
              interview: 0,
              offer: 0,
              rejected: 0,
            })

            const pendingCount = jobs.filter(isJobPendingFollowUp).length

            const activeCount = statusCounts.saved + statusCounts.applied + statusCounts.screen + statusCounts.interview

            let trackerHeadline = '暂无投递记录'
            let trackerDetail = '还没有和这份简历关联的岗位记录。'

            if (jobs.length > 0) {
              trackerHeadline = pendingCount > 0
                ? `${pendingCount} 个岗位待跟进`
                : statusCounts.offer > 0
                  ? `已拿到 ${statusCounts.offer} 个录用进展`
                  : statusCounts.interview > 0
                    ? `${statusCounts.interview} 个岗位进入面试`
                    : `${activeCount} 个岗位推进中`

              trackerDetail = latestJob
                ? `${latestJob.company} · ${latestJob.position}`
                : '最近没有新的投递变动。'
            }

            return {
              resume,
              version: {
                count: versionEntries.length,
                latestVersionNo: latestVersion?.version_no ?? null,
                latestVersionAt: latestVersion?.created_at ?? null,
                latestSource: latestVersion?.source_type ?? null,
                hasMilestone: versionEntries.some(entry => Boolean(entry.milestone_name)),
              },
              tracker: {
                jobCount: jobs.length,
                pendingCount,
                activeCount,
                interviewCount: statusCounts.interview,
                offerCount: statusCounts.offer,
                rejectedCount: statusCounts.rejected,
                latestJob: latestJob
                  ? {
                      company: latestJob.company,
                      position: latestJob.position,
                      updatedAt: latestJob.updated_at,
                      status: latestJob.status,
                    }
                  : null,
                headline: trackerHeadline,
                detail: trackerDetail,
              },
              ats: {
                checkedAt: ats?.created_at ?? null,
                score: ats?.summary?.overall_score ?? null,
                todoCount: ats?.todo_items?.length ?? 0,
                todoItems: ats?.todo_items?.slice(0, 4) ?? [],
                hasReport: Boolean(ats),
              },
            } satisfies ResumeSpotlight
          })
          .sort((left, right) => diffDates(
            resolveLatestActivity(right),
            resolveLatestActivity(left),
          ))

        setItems(nextItems)
      }
      catch (error) {
        console.error('加载首页简历聚合信息失败:', error)
        if (!cancelled) {
          setItems(onlineResumes.map(resume => ({
            resume,
            version: {
              count: 0,
              latestVersionNo: null,
              latestVersionAt: null,
              latestSource: null,
              hasMilestone: false,
            },
            tracker: {
              jobCount: 0,
              pendingCount: 0,
              activeCount: 0,
              interviewCount: 0,
              offerCount: 0,
              rejectedCount: 0,
              latestJob: null,
              headline: '暂无投递记录',
              detail: '还没有和这份简历关联的岗位记录。',
            },
            ats: {
              checkedAt: null,
              score: null,
              todoCount: 0,
              todoItems: [],
              hasReport: false,
            },
          })))
        }
      }
      finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [onlineResumes, resumesLoading, resumeIdsKey])

  return {
    items,
    loading,
  }
}

function resolveLatestActivity(item: ResumeSpotlight) {
  return item.tracker.latestJob?.updatedAt
    || item.ats.checkedAt
    || item.version.latestVersionAt
    || item.resume.updated_at
    || item.resume.created_at
}
