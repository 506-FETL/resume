import { createDashboardResource } from './resource-store'
import { EMPTY_DASHBOARD_JOBS, loadDashboardJobs } from './jobs'
import {
  getDashboardAtsSummary,
  listDashboardTrend,
  listDashboardVersions,
  loadDashboardWeeklyEdits,
} from './queries'
import type { DashboardResources } from './types'

const jobs = createDashboardResource(EMPTY_DASHBOARD_JOBS, loadDashboardJobs)

const ats = createDashboardResource(
  {
    avgAtsScore: null,
    atsResumeCount: 0,
    scoredResumeCount: 0,
    atsTodoTotal: 0,
  },
  getDashboardAtsSummary,
)

const trend = createDashboardResource([], listDashboardTrend)

const versions = createDashboardResource([], listDashboardVersions)

const weeklyEdits = createDashboardResource({}, loadDashboardWeeklyEdits)

const resources = [jobs, ats, trend, versions, weeklyEdits]

export function loadDashboardInsights(accountId: string | null) {
  resources.forEach((resource) => resource.load(accountId))
}

export function disconnectDashboardInsights(clearData: boolean) {
  resources.forEach((resource) => resource.disconnect(clearData))
}

export function useDashboardResources(): DashboardResources {
  return {
    jobs: jobs.useResource(),
    ats: ats.useResource(),
    trend: trend.useResource(),
    versions: versions.useResource(),
    weeklyEdits: weeklyEdits.useResource(),
  }
}
