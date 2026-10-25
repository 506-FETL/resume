import type { DashboardModeInput } from '../types'
import useUserStore from '@/store/user'
import { getDashboardMode } from '../utils'

export function useDashboardMode(
  input: Omit<DashboardModeInput, 'authStatus'>,
) {
  const authStatus = useUserStore((state) => state.authStatus)

  return getDashboardMode({ ...input, authStatus })
}
