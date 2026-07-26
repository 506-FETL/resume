import type { CollaborationPanelContextValue } from '../../types'
import { createContext, use } from 'react'

export const CollaborationPanelContext = createContext<CollaborationPanelContextValue | undefined>(undefined)

export function useCollaborationPanel() {
  const context = use(CollaborationPanelContext)

  if (!context) {
    throw new Error('useCollaborationPanel must be used within CollaborationPanelProvider')
  }

  return context
}
