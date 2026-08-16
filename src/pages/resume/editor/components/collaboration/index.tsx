import type { ReactNode } from 'react'
import { useCollaborationPanelValue } from '../../hooks/use-collaboration-panel-value'
import { CollaborationPanelContext } from './context'

export default function CollaborationPanelProvider({ children }: { children: ReactNode }) {
  const value = useCollaborationPanelValue()

  return <CollaborationPanelContext value={value}>{children}</CollaborationPanelContext>
}
