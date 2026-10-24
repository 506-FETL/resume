import dayjs from 'dayjs'
import { CalendarIcon, X } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useState } from 'react'
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
  const reduce = useReducedMotion()
  return (
    <div className='space-y-2'>
      <div className='text-xs font-medium text-muted-foreground'>{label}</div>
      <div className='flex items-center gap-1'>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
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
            className='w-auto p-0'
            align='start'
            style={{
              animationDuration: `${reduce ? 0 : DURATION.base}s`,
              animationTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
            }}
          >
            <Calendar
              mode='single'
              selected={value ? dayjs(value).toDate() : undefined}
              onSelect={(date) => {
                onChange(date ? dayjs(date).format('YYYY-MM-DD') : null)
                setOpen(false)
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
