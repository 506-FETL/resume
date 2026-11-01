import type { ResumeSnapshot } from '@/lib/supabase/resume/history'
import { ArrowRight, CheckCheck, RefreshCcw } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'
import { PresenceDiv } from '@/components/motion/presence-item'
import { Button } from '@/components/ui/button'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { staggerDelay } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { DiffView } from '@/pages/assistant/components/diff/diff-view'
import { diffSnapshots, totalChangedFields } from '../../compare'
import { useHistoryDialogMotion } from '../../hooks/use-history-dialog-motion'
import { useHistoryMotion } from '../../hooks/use-history-motion'
import useHistoryStore from '../../store'

const CURRENT = 'current'

interface CompareDialogProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  baseId: string | null
  targetId: string | null
}

interface ComparisonResult {
  key: string
  before: ResumeSnapshot | null
  after: ResumeSnapshot | null
}

export default function CompareDialog({
  open,
  onOpenChange,
  baseId,
  targetId,
}: CompareDialogProps) {
  const { versions, currentResume, loadVersionSnapshot } = useHistoryStore()
  const dialogMotion = useHistoryDialogMotion()
  const { surfaceProps } = useHistoryMotion()
  const [base, setBase] = useState(baseId ?? CURRENT)
  const [target, setTarget] = useState(targetId ?? CURRENT)
  const [result, setResult] = useState<ComparisonResult | null>(null)
  const [retry, setRetry] = useState(0)

  // Sync before paint when opening, so a previous pair never flashes under the new selectors.
  useLayoutEffect(() => {
    if (open) {
      setBase(baseId ?? CURRENT)
      setTarget(targetId ?? CURRENT)
    }
  }, [open, baseId, targetId])

  const options = useMemo(
    () => [
      ...(currentResume ? [{ value: CURRENT, label: '当前内容' }] : []),
      ...versions.map((version) => ({
        value: String(version.id),
        label: `第 ${version.version_no} 版 · ${new Date(version.created_at).toLocaleDateString()}`,
      })),
    ],
    [versions, currentResume],
  )

  const resolveSnap = useCallback(
    async (id: string): Promise<ResumeSnapshot | null> => {
      if (id === CURRENT) return currentResume?.snapshot ?? null

      return await loadVersionSnapshot(Number(id))
    },
    [currentResume, loadVersionSnapshot],
  )

  const requestKey = `${currentResume?.resumeId ?? ''}:${currentResume?.updatedAt ?? ''}:${base}:${target}:${retry}`

  useEffect(() => {
    if (!open) return

    let cancelled = false

    Promise.all([resolveSnap(base), resolveSnap(target)])
      .then(([before, after]) => {
        if (!cancelled) setResult({ key: requestKey, before, after })
      })
      .catch(() => {
        if (!cancelled)
          setResult({ key: requestKey, before: null, after: null })
      })

    return () => {
      cancelled = true
    }
  }, [open, base, target, resolveSnap, requestKey])

  const loading = result?.key !== requestKey
  const failed = !loading && (!result?.before || !result.after)

  const diffs = useMemo(
    () =>
      !loading && result?.before && result.after
        ? diffSnapshots(result.before, result.after)
        : [],
    [loading, result],
  )

  const changed = totalChangedFields(diffs)

  const resultState = loading
    ? 'loading'
    : failed
      ? 'error'
      : changed === 0
        ? 'empty'
        : `diff:${requestKey}`

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      contentClassName={cn(dialogMotion.contentClassName, 'sm:max-w-3xl')}
      overlayClassName={dialogMotion.overlayClassName}
    >
      <style>{dialogMotion.styles}</style>
      <ResponsiveDialogContent className='min-h-0 sm:max-h-[82vh]'>
        <ResponsiveDialogHeader className='shrink-0 gap-3 border-b px-5 pb-4 pt-5 text-left'>
          <ResponsiveDialogTitle>版本对比</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className='sr-only'>
            对比两个简历版本的内容。
          </ResponsiveDialogDescription>
          <div className='grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 pt-1'>
            <Select value={base} onValueChange={setBase}>
              <SelectTrigger
                aria-label='对比基准版本'
                className='h-8 min-w-0 w-full text-xs'
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                {...surfaceProps}
                position='popper'
                className={`${surfaceProps.className} history-popup-motion`}
              >
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ArrowRight className='size-3.5 text-muted-foreground' />
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger
                aria-label='对比目标版本'
                className='h-8 min-w-0 w-full text-xs'
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                {...surfaceProps}
                position='popper'
                className={`${surfaceProps.className} history-popup-motion`}
              >
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div
            className='flex h-4 items-center text-xs text-muted-foreground'
            aria-live='polite'
          >
            <AnimatePresence mode='wait' initial={false}>
              <motion.span
                key={loading ? 'loading' : failed ? 'error' : changed}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: dialogMotion.exitTransition }}
                transition={dialogMotion.enterTransition}
              >
                {loading
                  ? '正在加载版本内容…'
                  : failed
                    ? '版本内容暂时不可用'
                    : changed > 0
                      ? `共 ${changed} 处改动`
                      : '内容一致，无改动'}
              </motion.span>
            </AnimatePresence>
          </div>
        </ResponsiveDialogHeader>

        <div
          className='scrollbar-thin-subtle min-h-0 flex-1 overflow-y-auto overscroll-contain'
          aria-busy={loading}
        >
          <AnimatePresence mode='wait' initial={false}>
            <PresenceDiv
              key={resultState}
              initial={{ opacity: 0, y: dialogMotion.reduceMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{
                opacity: 0,
                y: dialogMotion.reduceMotion ? 0 : -4,
                transition: dialogMotion.exitTransition,
              }}
              transition={dialogMotion.enterTransition}
              className='flex flex-col gap-5 px-5 py-5'
            >
              {loading ? (
                <div
                  role='status'
                  aria-label='正在加载版本内容'
                  className='flex flex-col gap-4 py-2'
                >
                  {[0, 1].map((index) => (
                    <div key={index} className='flex flex-col gap-3'>
                      <Skeleton
                        className={cn(
                          'h-4 w-24',
                          dialogMotion.reduceMotion && 'animate-none',
                        )}
                      />
                      <Skeleton
                        className={cn(
                          'h-20 w-full',
                          dialogMotion.reduceMotion && 'animate-none',
                        )}
                      />
                    </div>
                  ))}
                </div>
              ) : failed ? (
                <div className='flex min-h-48 flex-col items-center justify-center gap-3 text-center'>
                  <p className='text-sm text-muted-foreground'>
                    暂时无法读取版本内容，请重试。
                  </p>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setRetry((value) => value + 1)}
                  >
                    <RefreshCcw data-icon='inline-start' />
                    重新加载
                  </Button>
                </div>
              ) : changed === 0 ? (
                <div className='flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 text-center'>
                  <CheckCheck className='size-6 text-muted-foreground' />
                  <p className='text-sm text-muted-foreground'>
                    两个版本内容一样
                  </p>
                </div>
              ) : (
                diffs.map((section, index) => (
                  <PresenceDiv
                    key={section.sectionKey}
                    initial={{
                      opacity: 0,
                      y: dialogMotion.reduceMotion ? 0 : 8,
                    }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      ...dialogMotion.enterTransition,
                      delay: dialogMotion.reduceMotion
                        ? 0
                        : staggerDelay(Math.min(index, 5)),
                    }}
                    className='flex flex-col gap-3'
                  >
                    <h3 className='text-sm font-semibold'>
                      {section.sectionLabel}
                    </h3>
                    {section.fields.map((field) => (
                      <div key={field.key} className='flex flex-col gap-1.5'>
                        <span className='text-xs text-muted-foreground'>
                          {field.label}
                        </span>
                        <DiffView before={field.before} after={field.after} />
                      </div>
                    ))}
                  </PresenceDiv>
                ))
              )}
            </PresenceDiv>
          </AnimatePresence>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
