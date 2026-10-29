import dayjs from 'dayjs'
import { CalendarIcon, X } from 'lucide-react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface WorkflowDateFieldProps {
  label: string
  value: string | null
  onChange: (value: string | null) => void
}

export default function WorkflowDateField({
  label,
  value,
  onChange,
}: WorkflowDateFieldProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && contentRef.current?.contains(document.activeElement))
      triggerRef.current?.focus({ preventScroll: true })

    setOpen(nextOpen)
  }

  return (
    <div className='space-y-2'>
      <div className='text-xs font-medium text-muted-foreground'>{label}</div>
      <div className='flex items-center gap-1'>
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button
              ref={triggerRef}
              type='button'
              variant='outline'
              aria-label={`${label}：${value || '未设置'}`}
              className={cn(
                'min-w-44 justify-start font-normal',
                !value && 'text-muted-foreground',
              )}
            >
              <CalendarIcon className='size-4' />
              {value || '选择日期'}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            ref={contentRef}
            inert={!open}
            className='w-auto p-0'
            align='start'
            style={{
              animationDuration: `${reduce ? 0 : open ? DURATION.base : DURATION.fast}s`,
              animationTimingFunction: `cubic-bezier(${(open ? EASE.out : EASE.in).join(',')})`,
            }}
          >
            <Calendar
              mode='single'
              selected={value ? dayjs(value).toDate() : undefined}
              onSelect={(date) => {
                onChange(date ? dayjs(date).format('YYYY-MM-DD') : null)
                handleOpenChange(false)
              }}
            />
          </PopoverContent>
        </Popover>
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          aria-label={`清除${label}`}
          disabled={!value}
          onClick={() => onChange(null)}
        >
          <X className='size-3.5' />
        </Button>
      </div>
    </div>
  )
}
