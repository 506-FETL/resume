import type { ReactNode } from 'react'
import type { VisibilityItemsType } from '@/lib/schema'
import { Tab } from '@/components/ui/side-tabs'
import { cn } from '@/lib/utils'

interface FixedTabProps {
  id: VisibilityItemsType
  label: string
  icon: ReactNode
  visible: boolean
  active: boolean
  isMobile: boolean
  onActivate: () => void
}

export function FixedTab({
  id,
  label,
  icon,
  visible,
  active,
  isMobile,
  onActivate,
}: FixedTabProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-end gap-2 select-none')}
      data-active={active}
    >
      {!isMobile && <div className='size-4' aria-hidden='true' />}

      <Tab id={id} onClick={onActivate} disabled={!visible}>
        {icon}
        {!isMobile && label}
      </Tab>
    </div>
  )
}
