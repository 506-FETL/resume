import type { ReactNode } from 'react'
import type { VisibilityItemsType } from '@/lib/schema'
import { Tab } from '@/components/ui/side-tabs'
import { Switch } from '@/components/ui/switch'

interface StaticTabProps {
  id: VisibilityItemsType
  label: string
  icon: ReactNode
  visible: boolean
  active: boolean
  isMobile: boolean
  onActivate: () => void
  onToggleVisibility: () => void
}

export function StaticTab({
  id,
  label,
  icon,
  visible,
  active,
  isMobile,
  onActivate,
  onToggleVisibility,
}: StaticTabProps) {
  return (
    <div
      className='flex flex-col items-center justify-end gap-2 select-none'
      data-active={active}
    >
      <div>
        <Switch
          aria-label={`${label}模块可见`}
          checked={visible}
          onCheckedChange={onToggleVisibility}
        />
      </div>

      <Tab id={id} onClick={onActivate} disabled={!visible}>
        {icon}
        {!isMobile && label}
      </Tab>
    </div>
  )
}
