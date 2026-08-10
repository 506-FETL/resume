import type { JobApplication } from '../../../types'
import dayjs from 'dayjs'
import { Bell, CalendarIcon, Check, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { updateCompany } from '@/lib/supabase/resume'
import { cn } from '@/lib/utils'
import { NEXT_ACTION_TONE_CLASSES } from '../../../const'
import useTrackerStore from '../../../store'
import { getNextActionBadge, getTrackerErrorMessage } from '../../../utils'

interface NextActionSectionProps {
  job: JobApplication
}

export default function NextActionSection({ job }: NextActionSectionProps) {
  const { syncJob } = useTrackerStore()
  const [action, setAction] = useState(job.next_action ?? '')
  const [date, setDate] = useState<string | null>(job.next_action_date ?? null)
  const [saving, setSaving] = useState(false)

  const isDirty = action.trim() !== (job.next_action ?? '').trim() || date !== (job.next_action_date ?? null)
  const badge = getNextActionBadge(job)
  const selectedDate = date ? dayjs(date).toDate() : undefined

  const handleSave = async () => {
    setSaving(true)
    const trimmed = action.trim()
    try {
      const savedJob = await updateCompany(job.id, {
        next_action: trimmed || null,
        next_action_date: date,
      })
      syncJob(savedJob)
    }
    catch (error) {
      toast.error('保存失败', { description: getTrackerErrorMessage(error) })
    }
    finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    setSaving(true)
    try {
      const savedJob = await updateCompany(job.id, { next_action: null, next_action_date: null })
      syncJob(savedJob)
      setAction('')
      setDate(null)
    }
    catch (error) {
      toast.error('操作失败', { description: getTrackerErrorMessage(error) })
    }
    finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bell className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">下一步跟进</h3>
        </div>
        {badge && (
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', NEXT_ACTION_TONE_CLASSES[badge.tone])}>
            {badge.label}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={action}
          placeholder="例如：发送感谢信 / 跟进 HR 回复"
          onChange={e => setAction(e.target.value)}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <CalendarIcon />
              {selectedDate ? dayjs(selectedDate).format('YYYY-MM-DD') : '选择日期'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={d => setDate(d ? dayjs(d).format('YYYY-MM-DD') : null)}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center justify-end gap-2">
        {(job.next_action || job.next_action_date) && (
          <Button variant="ghost" size="sm" className="h-8" disabled={saving} onClick={handleClear}>
            <X className="size-3.5" />
            清除
          </Button>
        )}
        <Button size="sm" className="h-8" disabled={!isDirty || saving} onClick={handleSave}>
          <Check className="size-3.5" />
          保存
        </Button>
      </div>
    </section>
  )
}
