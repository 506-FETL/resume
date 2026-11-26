import type { ComparisonChoice, VersionOption } from './use-comparison'
import { ArrowRight, CheckCheck, RefreshCcw } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useLayoutEffect, useMemo, useState } from 'react'
import { PresenceDiv } from '@/components/motion/presence-item'
import { Button } from '@/components/ui/button'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { staggerDelay } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { DiffLines } from '@/pages/assistant/components/diff/diff-view'
import { useHistoryDialogMotion } from '../../hooks/use-history-dialog-motion'
import useHistoryStore from '../../store'
import { useComparison, useDefaultBase } from './use-comparison'
import VersionPicker from './version-picker'
import { versionOptions } from './version-options'

interface CompareDialogProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  selectedVersion: VersionOption
  returnFocusTo: HTMLElement | null
}

export default function CompareDialog({
  open,
  onOpenChange,
  selectedVersion,
  returnFocusTo,
}: CompareDialogProps) {
  const dialogMotion = useHistoryDialogMotion()
  const [chosenBase, setChosenBase] = useState<ComparisonChoice>()
  const [target, setTarget] = useState<ComparisonChoice>(selectedVersion)
  const resumeId = useHistoryStore((s) => s.resumeId)
  const versionTotal = useHistoryStore((s) => s.versionTotal)
  const defaultBase = useDefaultBase(open && !chosenBase, selectedVersion)
  const base = chosenBase ?? defaultBase.choice
  const comparison = useComparison(open, base, target)
  const { diffs, changed } = comparison
  const failed = (defaultBase.error && !chosenBase) || comparison.failed
  const loading = !failed && comparison.loading

  const pages = useMemo(
    () => versionOptions(resumeId!, versionTotal),
    [resumeId, versionTotal],
  )

  const requestKey = [
    typeof base === 'object' ? base.id : base,
    typeof target === 'object' ? target.id : target,
  ].join(':')

  useLayoutEffect(() => {
    if (open) {
      setChosenBase(undefined)
      setTarget(selectedVersion)
    }
  }, [open, selectedVersion])

  const resultState = loading
    ? 'loading'
    : failed
      ? 'error'
      : changed === 0
        ? 'empty'
        : `diff:${requestKey}`

  return (
    <ResponsiveDialog
      returnFocusTo={returnFocusTo}
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
            <VersionPicker
              value={base}
              onChange={setChosenBase}
              ariaLabel='对比基准版本'
              pages={pages}
            />
            <ArrowRight className='size-3.5 text-muted-foreground' />
            <VersionPicker
              value={target}
              onChange={setTarget}
              ariaLabel='对比目标版本'
              pages={pages}
            />
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
                {loading ? (
                  <Skeleton className='h-3 w-20' />
                ) : failed ? (
                  '版本内容暂时不可用'
                ) : changed > 0 ? (
                  `共 ${changed} 处改动`
                ) : (
                  '内容一致，无改动'
                )}
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
                    onClick={() => {
                      defaultBase.retry()
                      comparison.retry()
                    }}
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
                        <DiffLines lines={field.lines} />
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

export { CompareDialog }
