import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import type { ReactNode } from 'react'

export function ChartEmpty({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <Empty className='min-h-[140px] gap-3 px-3 py-2'>
      <EmptyHeader className='gap-1.5'>
        <EmptyMedia variant='icon' className='mb-0 size-8'>
          {icon}
        </EmptyMedia>
        <EmptyTitle className='text-sm'>{title}</EmptyTitle>
        <EmptyDescription className='text-xs'>{description}</EmptyDescription>
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  )
}
