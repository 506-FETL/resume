import type { ReactNode } from 'react'
import type { VisibilityItemsType } from '@/lib/schema'
import { Tab } from '@/components/ui/side-tabs'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

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
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <Switch checked={visible} onCheckedChange={onToggleVisibility} />
          </div>
        </TooltipTrigger>
        <TooltipContent>点击可隐藏模块</TooltipContent>
      </Tooltip>

      <Tab id={id} onClick={onActivate} disabled={!visible}>
        {icon}
        {!isMobile && label}
      </Tab>
    </div>
  )
}
