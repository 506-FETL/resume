import type { ComponentType, ReactNode } from 'react'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'

interface RewriteDialogShellProps {
  children: ReactNode
  description?: string
  footer: ReactNode
  icon?: ComponentType<{ className?: string }>
  onOpenChange: (open: boolean) => void
  open: boolean
  title: string
}

export function RewriteDialogShell({
  children,
  description,
  footer,
  icon: Icon,
  onOpenChange,
  open,
  title,
}: RewriteDialogShellProps) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="flex flex-col gap-0 overflow-hidden p-0 sm:h-[85vh] sm:max-h-[85vh] sm:max-w-3xl">
        <ResponsiveDialogHeader className="shrink-0 border-b px-6 pb-4 pt-6">
          <ResponsiveDialogTitle className="flex items-center gap-2 text-base">
            {Icon ? <Icon className="size-4" /> : null}
            {title}
          </ResponsiveDialogTitle>
          {description && (
            <ResponsiveDialogDescription>
              {description}
            </ResponsiveDialogDescription>
          )}
        </ResponsiveDialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          {children}
        </div>

        {footer}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
