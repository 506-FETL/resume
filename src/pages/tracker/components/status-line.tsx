import type { ApplicationStatus } from '../types'
import { cn } from '@/lib/utils'

const STATUS_STEPS: ApplicationStatus[] = ['saved', 'applied', 'screen', 'interview', 'offer']

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  screen: 'Screen',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
}

interface StatusLineProps {
  currentStatus: ApplicationStatus
  onStatusChange?: (status: ApplicationStatus) => void
}

export function StatusLine({ currentStatus, onStatusChange }: StatusLineProps) {
  const currentIndex = STATUS_STEPS.indexOf(currentStatus)

  return (
    // 使用 inline-flex 让宽度自适应内容
    <div className="inline-flex flex-col gap-1">
      {/* 第一行：圆点 + 连接线 */}
      <div className="flex items-center">
        {STATUS_STEPS.map((status, index) => (
          <div key={status} className="flex items-center">
            <button
              type="button"
              onClick={() => onStatusChange?.(status)}
              className={cn(
                // 移动端更小的圆点，桌面端正常
                'size-2.5 md:size-3 rounded-full border-2 transition-all',
                'hover:scale-125 cursor-pointer',
                index <= currentIndex
                  ? 'bg-primary border-primary'
                  : 'bg-muted border-muted hover:border-primary/50',
              )}
            />
            {/* 连接线：移动端更短，桌面端正常 */}
            {index < STATUS_STEPS.length - 1 && (
              <div
                className={cn(
                  'w-6 md:w-10 h-0.5', // 移动端 24px，桌面端 40px
                  index < currentIndex ? 'bg-primary' : 'bg-muted',
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* 第二行：标签 */}
      <div className="flex justify-between">
        {STATUS_STEPS.map((status, index) => (
          <span
            key={status}
            className={cn(
              'text-[8px] md:text-[10px]', // 移动端更小字号
              index <= currentIndex ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {STATUS_LABELS[status]}
          </span>
        ))}
      </div>
    </div>
  )
}
