import type { ReactNode } from 'react'
import { PageLoading } from '@/components/page-loading'
import { useRecoveryNavigation } from '../../hooks/use-recovery-navigation'

export default function RecoveryGate({ children }: { children: ReactNode }) {
  const pending = useRecoveryNavigation()

  return pending ? <PageLoading label='正在恢复会话' /> : children
}
