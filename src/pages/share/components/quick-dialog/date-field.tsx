import { CalendarIcon, X } from 'lucide-react'
import { useState } from 'react'
import { createDeferredComponent } from '@/components/deferred-content'
import { Button } from '@/components/ui/button'
import { LoadingStatus } from '@/components/loading-status'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { formatDate } from '@/utils/date'

const Calendar = createDeferredComponent(
  () => import('./calendar-content'),
  '日历',
  <LoadingStatus
    label='正在加载日历'
    className='grid h-68 w-64 place-items-center'
  />,
  { wrapFallback: false },
)

interface DateFieldProps {
  value: Date | undefined
  onChange: (value: Date | undefined) => void
  className?: string
  disabled?: boolean
}

function startOfToday() {
  const today = new Date()

  today.setHours(0, 0, 0, 0)

  return today
}

export default function DateField({
  value,
  onChange,
  className,
  disabled = false,
}: DateFieldProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <Popover modal open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type='button'
            variant='outline'
            disabled={disabled}
            aria-label={`分享有效期：${value ? formatDate(value) : '长期有效'}`}
            className='min-w-0 flex-1 justify-start font-normal'
          >
            <CalendarIcon data-icon='inline-start' />
            <span className='truncate'>
              {value ? formatDate(value) : '长期有效'}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className='max-h-(--radix-popover-content-available-height) w-auto max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain p-0'
          align='start'
        >
          <Calendar
            autoFocus={open}
            mode='single'
            captionLayout='dropdown'
            selected={value}
            disabled={(date) => date < startOfToday()}
            onSelect={onChange}
          />
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          aria-label='清除有效期'
          disabled={disabled}
          onClick={() => onChange(undefined)}
        >
          <X data-icon='inline-start' />
        </Button>
      )}
    </div>
  )
}
