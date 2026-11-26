import type { ReactNode } from 'react'
import { FileText } from 'lucide-react'

export function PreviewHeader({
  name,
  children,
}: {
  name?: string
  children?: ReactNode
}) {
  return (
    <div className='flex min-h-12 shrink-0 items-center gap-2 border-b px-3 py-2 text-sm'>
      <FileText className='size-4 shrink-0 text-muted-foreground' />
      <span className='min-w-0 flex-1 truncate font-medium'>
        {name ?? '当前简历'}
      </span>
      {children}
    </div>
  )
}
