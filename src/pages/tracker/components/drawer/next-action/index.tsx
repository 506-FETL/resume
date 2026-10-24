import type { JobApplication } from '../../../types'
import dayjs from 'dayjs'
import { Bell, CalendarIcon, Check, Loader2, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useIsMobile } from '@/hooks/use-mobile'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { NEXT_ACTION_TONE_CLASSES } from '../../../const'
import { isTrackerAccountScopeError } from '../../../lib/account-scope'
import useTrackerStore from '../../../store'
import { getNextActionBadge, getTrackerErrorMessage } from '../../../utils'

interface NextActionSectionProps {
  job: JobApplication
}

export default function NextActionSection({ job }: NextActionSectionProps) {
  const saveJobFields = useTrackerStore((state) => state.saveJobFields)
  const [action, setAction] = useState(job.next_action ?? '')
  const [date, setDate] = useState<string | null>(job.next_action_date ?? null)
  const [saving, setSaving] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)
  const reduce = useReducedMotion()
  const isMobile = useIsMobile()

  const isDirty =
    action.trim() !== (job.next_action ?? '').trim() ||
    date !== (job.next_action_date ?? null)
  const badge = getNextActionBadge(job)
  const selectedDate = date ? dayjs(date).toDate() : undefined
  const hasSavedAction = Boolean(job.next_action || job.next_action_date)
  const chooseDate = (value: string | null) => {
    setDate(value)
    setDateOpen(false)
  }

  const handleSave = async () => {
    if (!isDirty || saving) return
    setSaving(true)
    const trimmed = action.trim()
    try {
      await saveJobFields(job.id, {
        next_action: trimmed || null,
        next_action_date: date,
      })
    } catch (error) {
      if (isTrackerAccountScopeError(error)) return
      toast.error('保存失败', { description: getTrackerErrorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    setSaving(true)
    try {
      await saveJobFields(job.id, { next_action: null, next_action_date: null })
      setAction('')
      setDate(null)
    } catch (error) {
      if (isTrackerAccountScopeError(error)) return
      toast.error('操作失败', { description: getTrackerErrorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  const datePicker = (
    <Popover open={dateOpen} onOpenChange={setDateOpen}>
      <PopoverTrigger asChild>
        <InputGroupButton
          size='sm'
          className='h-9 px-2 font-normal'
          aria-label={`跟进日期：${date || '未设置'}`}
          disabled={saving}
        >
          <CalendarIcon className='size-3.5' />
          {selectedDate ? dayjs(selectedDate).format('M月D日') : '安排日期'}
        </InputGroupButton>
      </PopoverTrigger>
      <PopoverContent
        className='w-auto p-0'
        align={isMobile ? 'end' : 'start'}
        style={{
          animationDuration: `${reduce ? 0 : DURATION.base}s`,
          animationTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
        }}
      >
        <div className='flex items-center gap-1 border-b p-2'>
          <Button
            size='sm'
            variant='ghost'
            onClick={() => chooseDate(dayjs().format('YYYY-MM-DD'))}
          >
            今天
          </Button>
          <Button
            size='sm'
            variant='ghost'
            onClick={() =>
              chooseDate(dayjs().add(1, 'day').format('YYYY-MM-DD'))
            }
          >
            明天
          </Button>
          <Button
            size='sm'
            variant='ghost'
            disabled={!date}
            onClick={() => chooseDate(null)}
          >
            无日期
          </Button>
        </div>
        <Calendar
          mode='single'
          selected={selectedDate}
          onSelect={(value) =>
            chooseDate(value ? dayjs(value).format('YYYY-MM-DD') : null)
          }
        />
      </PopoverContent>
    </Popover>
  )

  return (
    <section
      aria-label='下一步跟进'
      className='shrink-0 space-y-1.5 sm:space-y-3'
    >
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <Bell className='size-4 text-muted-foreground' />
          <h3 className='text-sm font-semibold'>下一步跟进</h3>
        </div>
        {isMobile ? (
          datePicker
        ) : (
          <AnimatePresence initial={false}>
            {badge && (
              <motion.span
                key={badge.label}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : DURATION.fast }}
                className={cn(
                  'rounded-md px-2 py-0.5 text-xs font-medium',
                  NEXT_ACTION_TONE_CLASSES[badge.tone],
                )}
              >
                {badge.label}
              </motion.span>
            )}
          </AnimatePresence>
        )}
      </div>
      <InputGroup
        className={cn(
          'overflow-hidden shadow-none',
          isMobile ? 'h-10 rounded-lg' : 'rounded-xl',
        )}
        style={{ transitionDuration: `${reduce ? 0 : DURATION.fast}s` }}
      >
        <InputGroupInput
          aria-label='跟进事项'
          value={action}
          placeholder='填写下一步安排…'
          className={cn('min-w-0 px-3', isMobile ? 'h-10' : 'h-12')}
          disabled={saving}
          onChange={(e) => setAction(e.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault()
              handleSave()
            }
          }}
        />
        <InputGroupAddon
          align={isMobile ? 'inline-end' : 'block-end'}
          className={
            isMobile
              ? 'shrink-0 gap-1 py-0 pr-1'
              : 'flex-wrap gap-1.5 border-t bg-muted/25 p-2'
          }
        >
          {!isMobile && datePicker}
          <div className='ml-auto flex items-center gap-1'>
            <InputGroupButton
              size={isMobile ? 'icon-sm' : 'sm'}
              className='h-9 px-2'
              disabled={!hasSavedAction || saving}
              onClick={handleClear}
              aria-label='清除跟进'
              title='清除跟进'
            >
              <X className='size-3.5' />
              {!isMobile && '清除'}
            </InputGroupButton>
            <InputGroupButton
              variant='default'
              size='sm'
              className='h-9 px-3'
              disabled={!isDirty || saving}
              onClick={handleSave}
              aria-label={
                saving
                  ? '保存跟进中'
                  : !isDirty && hasSavedAction
                    ? '跟进已保存'
                    : '保存跟进'
              }
            >
              {saving ? (
                <Loader2
                  className={cn('size-3.5', !reduce && 'animate-spin')}
                />
              ) : (
                <Check className='size-3.5' />
              )}
              {saving
                ? '保存中'
                : !isDirty && hasSavedAction
                  ? '已保存'
                  : '保存'}
            </InputGroupButton>
          </div>
        </InputGroupAddon>
      </InputGroup>
    </section>
  )
}
