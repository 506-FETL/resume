import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FollowModeToggleProps {
  enabled: boolean
  onToggle: () => void
}

export function FollowModeToggle({ enabled, onToggle }: FollowModeToggleProps) {
  return (
    <Button
      variant={enabled ? 'default' : 'outline'}
      size='sm'
      className='h-7 gap-1 text-xs'
      onClick={onToggle}
    >
      {enabled ? <Eye className='size-3' /> : <EyeOff className='size-3' />}
      {enabled ? '跟随中' : '独立浏览'}
    </Button>
  )
}
