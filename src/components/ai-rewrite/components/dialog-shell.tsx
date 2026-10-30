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
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      contentClassName='h-[min(88dvh,800px)] gap-0 sm:max-w-3xl'
    >
      <ResponsiveDialogContent className='min-h-0 flex-col gap-0 overflow-hidden p-0'>
        <ResponsiveDialogHeader className='shrink-0 border-b px-6 pb-4 pt-6'>
          <ResponsiveDialogTitle className='flex items-center gap-2 text-base'>
            {Icon ? <Icon className='size-4' /> : null}
            {title}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription
            className={description ? undefined : 'sr-only'}
          >
            {description || '查看并选择改写建议。'}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className='flex min-h-0 flex-1 flex-col'>{children}</div>

        {footer}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
