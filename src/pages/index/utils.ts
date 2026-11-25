import type { DashboardMode, DashboardModeInput } from './types'

export function getDashboardMode(input: DashboardModeInput): DashboardMode {
  if (input.authStatus === 'unknown') return 'pending'
  if (input.authStatus === 'anonymous') return 'guest'

  const confirmedEmpty =
    input.accountMatches &&
    input.resumeCount === 0 &&
    input.jobsCount === 0 &&
    input.resumesConfirmedEmpty &&
    input.jobsConfirmedEmpty

  return confirmedEmpty ? 'onboarding' : 'workspace'
}

export function dashboardDayStarts(now = new Date()) {
  const monday = new Date(now)

  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))

  return Array.from({ length: 8 }, (_, index) => {
    const day = new Date(monday)

    day.setDate(monday.getDate() + index)

    return day
  })
}
