import * as React from 'react'

interface BaseProps {
  children: React.ReactNode
}

interface RootProps extends BaseProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export interface ResponsiveDialogProps extends RootProps {
  returnFocusTo?: HTMLElement | null
  trigger?: React.ReactElement
  variant?: 'default' | 'sidebar'
  errors?: Record<string, boolean>
  contentClassName?: string
  overlayClassName?: string
}
