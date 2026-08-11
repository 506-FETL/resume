import { CalendarIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { formatDate } from '@/utils/date'

interface ShareDateFieldProps {
  value: Date | undefined
  onChange: (value: Date | undefined) => void
  className?: string
}

function startOfToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

export default function ShareDateField({ value, onChange, className }: ShareDateFieldProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="min-w-0 flex-1 justify-start font-normal">
            <CalendarIcon data-icon="inline-start" />
            <span className="truncate">{value ? formatDate(value) : '长期有效'}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            captionLayout="dropdown"
            selected={value}
            disabled={date => date < startOfToday()}
            onSelect={onChange}
          />
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="清除有效期"
          onClick={() => onChange(undefined)}
        >
          <X />
        </Button>
      )}
    </div>
  )
}
