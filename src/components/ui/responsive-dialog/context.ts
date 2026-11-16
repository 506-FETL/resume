import * as React from 'react'

export const ResponsiveDialogContext = React.createContext<{
  activeSection: string
  setActiveSection: (id: string) => void
  isMobile: boolean
  variant: 'default' | 'sidebar'
  errors?: Record<string, boolean>
} | null>(null)

export function useResponsiveDialogContext() {
  const context = React.useContext(ResponsiveDialogContext)

  if (!context) {
    throw new Error(
      'useResponsiveDialogContext must be used within ResponsiveDialog',
    )
  }

  return context
}
