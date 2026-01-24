import dayjs from 'dayjs'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

function DateRangeEditor({ value, onChange }: {
  value: string[]
  onChange: (val: string[]) => void
}) {
  const [start, end] = value || ['', '']
  const isUptoNow = end === '至今'

  const parseDate = (dateStr: string | undefined): Date | undefined => {
    if (!dateStr || dateStr === '至今')
      return undefined
    const d = dayjs(dateStr)
    return d.isValid() ? d.toDate() : undefined
  }

  const formatDate = (date: Date | undefined): string => {
    if (!date)
      return ''
    return dayjs(date).format('YYYY-MM-DD')
  }

  return (
    <div className="space-y-3">
      {/* 日期选择区域 - 移动端垂直排列，桌面端水平排列 */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 sm:gap-3 items-end">
        {/* 开始时间 */}
        <div className="w-full">
          <label className="text-xs text-muted-foreground mb-1.5 block">开始时间</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal h-9',
                  !start && 'text-muted-foreground',
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <span className="truncate">{start || '选择开始时间'}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start">
              <Calendar
                mode="single"
                captionLayout="dropdown"
                defaultMonth={parseDate(start) || dayjs().toDate()}
                selected={parseDate(start)}
                onSelect={date => onChange([formatDate(date), end])}
                disabled={date => dayjs(date).isAfter(dayjs())}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* 分隔符 - 仅桌面端显示 */}
        <span className="text-muted-foreground hidden sm:flex items-center justify-center h-9">—</span>

        {/* 结束时间 */}
        <div className="w-full">
          <label className="text-xs text-muted-foreground mb-1.5 block">结束时间</label>
          <div className="flex gap-2 items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  disabled={isUptoNow}
                  className={cn(
                    'flex-1 justify-start text-left font-normal h-9',
                    !end && 'text-muted-foreground',
                    isUptoNow && 'opacity-50',
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <span className="truncate">{end || '选择结束时间'}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start">
                <Calendar
                  mode="single"
                  captionLayout="dropdown"
                  defaultMonth={parseDate(end) || dayjs().toDate()}
                  selected={parseDate(end)}
                  onSelect={date => onChange([start, formatDate(date)])}
                  disabled={date => dayjs(date).isAfter(dayjs())}
                />
              </PopoverContent>
            </Popover>
            {/* 至今选项 - 内联到结束时间行 */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Checkbox
                id="date-range-up-to-now"
                checked={isUptoNow}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onChange([start, '至今'])
                  }
                  else {
                    onChange([start, ''])
                  }
                }}
              />
              <Label htmlFor="date-range-up-to-now" className="text-sm cursor-pointer whitespace-nowrap">至今</Label>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DateRangeEditor
