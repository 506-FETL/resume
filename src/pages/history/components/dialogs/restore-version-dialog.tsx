import type {
  RestoreStrategy,
  ResumeHistoryVersionListItem,
} from '@/lib/supabase/resume/history'
import { AlertTriangle, LoaderCircle, RotateCcw } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  useHistoryDialogCloseReset,
  useHistoryDialogMotion,
} from '../../hooks/use-history-dialog-motion'
import { getVersionTitle } from '../../utils'

interface RestoreVersionDialogProps {
  targetVersion: ResumeHistoryVersionListItem | null
  restoring: boolean
  restoreStrategy: RestoreStrategy | null
  onOpenChange: (open: boolean) => void
  onConfirm: (strategy: RestoreStrategy) => Promise<void>
}

export default function RestoreVersionDialog({
  targetVersion,
  restoring,
  restoreStrategy,
  onOpenChange,
  onConfirm,
}: RestoreVersionDialogProps) {
  // 「直接恢复」是不备份的不可逆操作，点一次先进入二次确认，再点才真正执行
  const [confirmingDirect, setConfirmingDirect] = useState(false)
  const [retainedTarget, setRetainedTarget] = useState(targetVersion)
  const dialogMotion = useHistoryDialogMotion()
  const resetConfirmation = useCallback(() => setConfirmingDirect(false), [])
  const confirmationRef = useRef<HTMLDivElement>(null)
  useHistoryDialogCloseReset(
    Boolean(targetVersion),
    resetConfirmation,
    confirmationRef,
  )

  useLayoutEffect(() => {
    if (targetVersion) {
      if (retainedTarget?.id !== targetVersion.id) setConfirmingDirect(false)
      setRetainedTarget(targetVersion)
    }
  }, [targetVersion, retainedTarget?.id])

  const displayedTarget = targetVersion ?? retainedTarget
  const versionTitle = displayedTarget ? getVersionTitle(displayedTarget) : ''

  return (
    <AlertDialog
      open={Boolean(targetVersion)}
      onOpenChange={(open) => {
        if (!open && !restoring) {
          onOpenChange(open)
        }
      }}
    >
      <AlertDialogContent
        className={dialogMotion.contentClassName}
        overlayClassName={dialogMotion.overlayClassName}
      >
        <style>{dialogMotion.styles}</style>
        <AlertDialogHeader>
          <AlertDialogMedia className='bg-accent text-accent-foreground'>
            <RotateCcw />
          </AlertDialogMedia>
          <AlertDialogTitle>
            {versionTitle ? `恢复到「${versionTitle}」？` : '恢复此版本？'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {versionTitle
              ? `当前正在编辑的内容会被「${versionTitle}」覆盖，并生成一条新的恢复记录。`
              : '恢复后，当前内容会被此版本覆盖，并生成一条新的恢复记录。'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AnimatePresence initial={false} mode='wait'>
          <motion.div
            ref={confirmationRef}
            key={confirmingDirect ? 'direct-confirmation' : 'restore-options'}
            initial={{ opacity: 0, y: dialogMotion.reduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{
              opacity: 0,
              y: dialogMotion.reduceMotion ? 0 : -4,
              transition: dialogMotion.exitTransition,
            }}
            transition={dialogMotion.enterTransition}
            className='flex min-w-0 flex-col gap-6'
          >
            {confirmingDirect ? (
              <div className='text-sm'>
                <div className='flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-foreground'>
                  <AlertTriangle className='mt-0.5 size-4 shrink-0 text-destructive' />
                  <p className='leading-6'>
                    直接恢复
                    <span className='font-medium text-destructive'>
                      不会保存当前内容
                    </span>
                    ，未保存的修改将被覆盖，无法恢复。
                  </p>
                </div>
              </div>
            ) : (
              <div className='grid gap-3 text-sm text-muted-foreground'>
                <div className='rounded-xl border border-border/70 bg-muted/20 px-4 py-3'>
                  <div className='font-medium text-foreground'>
                    恢复并保留当前内容
                  </div>
                  <p className='mt-1 leading-6'>
                    先将当前内容保存为“恢复前备份”，再恢复所选版本。
                  </p>
                </div>
                <div className='rounded-xl border border-border/70 bg-muted/20 px-4 py-3'>
                  <div className='font-medium text-foreground'>直接恢复</div>
                  <p className='mt-1 leading-6'>
                    不备份当前内容，直接恢复所选版本。
                  </p>
                </div>
              </div>
            )}

            <AlertDialogFooter>
              {confirmingDirect ? (
                <>
                  <Button
                    variant='outline'
                    disabled={restoring}
                    onClick={() => setConfirmingDirect(false)}
                  >
                    返回
                  </Button>
                  <Button
                    variant='destructive'
                    disabled={restoring}
                    onClick={() => onConfirm('without_backup')}
                  >
                    {restoring && restoreStrategy === 'without_backup' && (
                      <LoaderCircle
                        data-icon='inline-start'
                        className={cn(
                          !dialogMotion.reduceMotion && 'animate-spin',
                        )}
                      />
                    )}
                    {restoring && restoreStrategy === 'without_backup'
                      ? '恢复中...'
                      : '仍要直接恢复'}
                  </Button>
                </>
              ) : (
                <>
                  <AlertDialogCancel disabled={restoring}>
                    取消
                  </AlertDialogCancel>
                  <Button
                    variant='outline'
                    disabled={restoring}
                    onClick={() => setConfirmingDirect(true)}
                  >
                    直接恢复
                  </Button>
                  <Button
                    disabled={restoring}
                    onClick={() => onConfirm('with_backup')}
                  >
                    {restoring && restoreStrategy === 'with_backup' && (
                      <LoaderCircle
                        data-icon='inline-start'
                        className={cn(
                          !dialogMotion.reduceMotion && 'animate-spin',
                        )}
                      />
                    )}
                    {restoring && restoreStrategy === 'with_backup'
                      ? '恢复中...'
                      : '恢复并保留当前内容'}
                  </Button>
                </>
              )}
            </AlertDialogFooter>
          </motion.div>
        </AnimatePresence>
      </AlertDialogContent>
    </AlertDialog>
  )
}
