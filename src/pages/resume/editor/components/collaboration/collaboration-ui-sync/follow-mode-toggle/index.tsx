import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface FollowModeToggleProps {
  enabled: boolean
  onToggle: () => void
}

export function FollowModeToggle({ enabled, onToggle }: FollowModeToggleProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={enabled ? 'default' : 'outline'}
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={onToggle}
        >
          {enabled ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
          {enabled ? '跟随中' : '独立浏览'}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {enabled
          ? '跟随协作者的界面操作'
          : '各自浏览，界面操作互不同步'}
      </TooltipContent>
    </Tooltip>
  )
}
