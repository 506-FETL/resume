import type { JobApplication } from '../../../types'
import dayjs from 'dayjs'
import {
  Bell,
  CalendarIcon,
  Check,
  ChevronDown,
  Loader2,
  X,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { NEXT_ACTION_TONE_CLASSES } from '../../../const'
import { isTrackerAccountScopeError } from '../../../lib/account-scope'
import useTrackerStore from '../../../store'
import { getNextActionBadge, getTrackerErrorMessage } from '../../../utils'

interface NextActionSectionProps {
  job: JobApplication
}

interface FollowUpDraft {
  action: string
  date: string | null
}

export default function NextActionSection({ job }: NextActionSectionProps) {
  const saveJobFields = useTrackerStore((state) => state.saveJobFields)
  const [draft, setDraft] = useState<FollowUpDraft | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const dateTriggerRef = useRef<HTMLButtonElement>(null)
  const dateContentRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const inputId = useId()
  const reduce = useReducedMotion()
  const action = draft?.action ?? job.next_action ?? ''
  const date = draft ? draft.date : (job.next_action_date ?? null)

  const isDirty =
    action.trim() !== (job.next_action ?? '').trim() ||
    date !== (job.next_action_date ?? null)

  const badge = getNextActionBadge(job)
  const selectedDate = date ? dayjs(date).toDate() : undefined
  const hasSavedAction = Boolean(job.next_action || job.next_action_date)
  const badgeLabel = saving ? '保存中' : isDirty ? '未保存' : badge?.label

  const handleOpenChange = (value: boolean) => {
    if (
      !value &&
      (contentRef.current?.contains(document.activeElement) ||
        dateContentRef.current?.contains(document.activeElement))
    )
      triggerRef.current?.focus({ preventScroll: true })

    setOpen(value)

    if (!value) setDateOpen(false)
  }

  const handleDateOpenChange = (value: boolean) => {
    if (!value && dateContentRef.current?.contains(document.activeElement))
      dateTriggerRef.current?.focus({ preventScroll: true })

    setDateOpen(value)
  }

  const chooseDate = (value: string | null) => {
    setDraft({ action, date: value })
    handleDateOpenChange(false)
  }

  const handleSave = async () => {
    if (!isDirty || saving) return

    setSaving(true)

    try {
      await saveJobFields(job.id, {
        next_action: action.trim() || null,
        next_action_date: date,
      })

      setDraft(null)
      handleOpenChange(false)
    } catch (error) {
      if (isTrackerAccountScopeError(error)) return

      toast.error('保存失败', { description: getTrackerErrorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    if (saving) return

    if (!hasSavedAction) {
      setDraft(null)
      inputRef.current?.focus()

      return
    }

    setSaving(true)

    try {
      await saveJobFields(job.id, { next_action: null, next_action_date: null })
      setDraft(null)
      handleOpenChange(false)
    } catch (error) {
      if (isTrackerAccountScopeError(error)) return

      toast.error('清除失败', { description: getTrackerErrorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='min-w-0 shrink-0'>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            variant='outline'
            size='sm'
            aria-label='编辑跟进安排'
            className='h-8 max-w-full min-w-0 gap-1.5 rounded-lg px-2.5 text-xs shadow-none'
            style={{ transitionDuration: `${reduce ? 0 : DURATION.base}s` }}
          >
            <Bell className='size-3.5' />
            <span className='shrink-0'>跟进安排</span>
            {job.next_action && (
              <span
                className='min-w-0 truncate font-normal text-muted-foreground'
                title={job.next_action}
              >
                {job.next_action}
              </span>
            )}
            <AnimatePresence initial={false} mode='popLayout'>
              {badgeLabel && (
                <motion.span
                  key={badgeLabel}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduce ? 0 : DURATION.fast }}
                  className={cn(
                    'shrink-0 rounded px-1.5 py-0.5 text-[10px]',
                    saving || isDirty
                      ? 'bg-muted text-muted-foreground'
                      : badge && NEXT_ACTION_TONE_CLASSES[badge.tone],
                  )}
                >
                  {badgeLabel}
                </motion.span>
              )}
            </AnimatePresence>
            <ChevronDown className='size-3 text-muted-foreground' />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          ref={contentRef}
          align='start'
          sideOffset={8}
          collisionPadding={16}
          aria-labelledby={titleId}
          inert={!open}
          className='max-h-[var(--radix-popover-content-available-height)] w-80 max-w-[calc(100vw-2rem)] gap-3 overflow-y-auto rounded-xl'
          style={{
            animationDuration: `${reduce ? 0 : open ? DURATION.base : DURATION.fast}s`,
            animationTimingFunction: `cubic-bezier(${(open ? EASE.out : EASE.in).join(',')})`,
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            inputRef.current?.focus({ preventScroll: true })
          }}
        >
          <div className='flex items-center justify-between gap-2'>
            <h3 id={titleId} className='text-sm font-semibold'>
              跟进安排
            </h3>
            <Button
              variant='ghost'
              size='icon-sm'
              className='size-6'
              aria-label='关闭跟进安排'
              onClick={() => handleOpenChange(false)}
            >
              <X className='size-3.5' />
            </Button>
          </div>
          <div className='space-y-1.5'>
            <label htmlFor={inputId} className='text-xs text-muted-foreground'>
              事项
            </label>
            <Input
              ref={inputRef}
              id={inputId}
              aria-label='跟进事项'
              value={action}
              placeholder='例如：问问面试结果'
              disabled={saving}
              onChange={(event) =>
                setDraft({ action: event.target.value, date })
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  handleSave()
                }
              }}
            />
          </div>
          <Popover open={dateOpen} onOpenChange={handleDateOpenChange}>
            <PopoverTrigger asChild>
              <Button
                ref={dateTriggerRef}
                variant='outline'
                className='w-full justify-start font-normal shadow-none'
                aria-label={`跟进日期：${date || '未设置'}`}
                disabled={saving}
              >
                <CalendarIcon className='size-3.5' />
                {selectedDate
                  ? dayjs(selectedDate).format('YYYY年M月D日')
                  : '选择日期'}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              ref={dateContentRef}
              align='start'
              collisionPadding={16}
              aria-label='选择跟进日期'
              inert={!dateOpen}
              className='w-auto max-w-[calc(100vw-2rem)] p-0'
              style={{
                animationDuration: `${reduce ? 0 : dateOpen ? DURATION.base : DURATION.fast}s`,
                animationTimingFunction: `cubic-bezier(${(dateOpen ? EASE.out : EASE.in).join(',')})`,
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
          <div className='flex items-center justify-between gap-2 border-t pt-3'>
            <Button
              variant='ghost'
              size='sm'
              className='px-2'
              disabled={(!hasSavedAction && !isDirty) || saving}
              onClick={handleClear}
              aria-label='清除跟进'
            >
              清除
            </Button>
            <Button
              size='sm'
              disabled={!isDirty || saving}
              onClick={handleSave}
              aria-label={saving ? '保存跟进中' : '保存跟进'}
            >
              {saving ? (
                <Loader2
                  className={cn('size-3.5', !reduce && 'animate-spin')}
                />
              ) : (
                <Check className='size-3.5' />
              )}
              {saving ? '保存中' : '保存'}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
