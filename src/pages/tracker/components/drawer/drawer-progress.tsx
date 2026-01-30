import type { ApplicationStatus } from '../../types'
import { cn } from '@/lib/utils'

const STATUS_STEPS: ApplicationStatus[] = ['saved', 'applied', 'screen', 'interview', 'offer']
const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  screen: 'Screen',
  interview: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
}
interface DrawerProgressProps {
  currentStatus: ApplicationStatus
  onStatusChange?: (status: ApplicationStatus) => void
}
export function DrawerProgress({ currentStatus, onStatusChange }: DrawerProgressProps) {
  const currentIndex = STATUS_STEPS.indexOf(currentStatus)
  return (
    <div className="py-4 border-b">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Application Progress</span>
        <span className="text-sm text-muted-foreground">
          {currentIndex + 1}
          {' '}
          /
          {' '}
          {STATUS_STEPS.length}
        </span>
      </div>
      {/* 进度条 */}
      <div className="h-2 bg-muted rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${((currentIndex + 1) / STATUS_STEPS.length) * 100}%` }}
        />
      </div>
      {/* 节点 */}
      <div className="flex justify-between">
        {STATUS_STEPS.map((status, index) => (
          <button
            key={status}
            type="button"
            onClick={() => onStatusChange?.(status)}
            className="flex flex-col items-center gap-1"
          >
            <div className={cn(
              'size-8 rounded-full flex items-center justify-center text-xs font-medium transition-all',
              index <= currentIndex
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground',
              index === currentIndex && 'ring-2 ring-primary ring-offset-2',
            )}
            >
              {index + 1}
            </div>
            <span className={cn(
              'text-xs',
              index <= currentIndex ? 'text-foreground' : 'text-muted-foreground',
            )}
            >
              {STATUS_LABELS[status]}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
