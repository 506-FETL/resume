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
