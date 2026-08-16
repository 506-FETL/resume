import type { ReactNode } from 'react'
import { getUserDisplayName } from '@/hooks/use-current-user'
import useCurrentResumeStore from '@/store/resume/current'
import useUserStore from '@/store/user'
import { useCollaborationPanelValue } from '../../hooks/use-collaboration-panel-value'
import { CollaborationPanelContext } from './context'

export default function CollaborationPanelProvider({ children }: { children: ReactNode }) {
  const currentUser = useUserStore(state => state.currentUser)
  const activeResumeId = useCurrentResumeStore(state => state.resumeId) ?? undefined
  const userDisplayName = getUserDisplayName(currentUser)
  const value = useCollaborationPanelValue({ currentUser, activeResumeId, userDisplayName })

  return <CollaborationPanelContext value={value}>{children}</CollaborationPanelContext>
}
