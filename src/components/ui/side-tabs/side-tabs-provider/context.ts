'use client'

import { createContext, use } from 'react'
import type { SideTabsContextValue } from './types'

export const SideTabsContext = createContext<SideTabsContextValue | null>(null)

export function useSideTabsContext() {
  const context = use(SideTabsContext)

  if (!context) {
    throw new Error('SideTabs components must be used within a SideTabsWrapper')
  }

  return context
}
