import { createContext, use } from 'react'
import type { CrossListDragContextValue } from './types'

export const CrossListDragContext =
  createContext<CrossListDragContextValue | null>(null)

export function useCrossListDragContext(): CrossListDragContextValue {
  const context = use(CrossListDragContext)

  if (!context)
    throw new Error(
      'Cross-list drag parts must be placed within CrossListDragProvider',
    )

  return context
}
