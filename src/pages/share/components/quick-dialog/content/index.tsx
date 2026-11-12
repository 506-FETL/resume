import type { ComponentProps } from 'react'
import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import type { VersionOptionsEntry } from '../../../store/types'
import { useLayoutEffect } from 'react'
import { RefreshCcw } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import AnimatedContent from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import { ContentSkeleton } from '@/components/loading-skeleton'
import { CreateForm } from '../create-form'
import { LinkRow } from '../link-row'

interface QuickDialogContentProps {
  display: {
    resumeId: string | null
    shares: ResumeShareRecord[]
    loading: boolean
    error: string | null
    versionEntry?: VersionOptionsEntry
  } | null
  formId: string
  submitting: boolean
  setSubmitting: (value: boolean) => void
  pendingShareIds: string[]
  onReadyChange: (ready: boolean) => void
  onRetryVersions: () => void
  onRetryShares: () => void
  onCreate: ComponentProps<typeof CreateForm>['onCreate']
}

export default function QuickDialogContent({
  display,
  formId,
  submitting,
  setSubmitting,
  pendingShareIds,
  onReadyChange,
  onRetryVersions,
  onRetryShares,
  onCreate,
}: QuickDialogContentProps) {
  useLayoutEffect(() => {
    onReadyChange(true)

    return () => onReadyChange(false)
  }, [onReadyChange])

  return (
    <div className='space-y-6'>
      <CreateForm
        key={display?.resumeId}
        formId={formId}
        submitting={submitting}
        onSubmittingChange={setSubmitting}
        versions={display?.versionEntry?.items ?? []}
        versionsLoading={display?.versionEntry?.loading ?? false}
        versionsError={display?.versionEntry?.error ?? null}
        onRetryVersions={onRetryVersions}
        onCreate={onCreate}
      />
      <section
        className='min-w-0 space-y-3 border-t pt-5'
        aria-labelledby={`${formId}-links-heading`}
      >
        <div className='flex items-center justify-between gap-2'>
          <h3 id={`${formId}-links-heading`} className='text-sm font-medium'>
            已有链接
          </h3>
          {!display?.loading && !display?.error && (
            <span className='text-xs tabular-nums text-muted-foreground'>
              {display?.shares.length ?? 0} 个
            </span>
          )}
        </div>
        <AnimatedContent
          animationKey={
            display?.loading && !display.shares.length
              ? 'loading'
              : display?.error
                ? 'error'
                : display?.shares.length === 0
                  ? 'empty'
                  : 'ready'
          }
          className='empty:hidden'
        >
          {display?.loading && !display.shares.length ? (
            <ContentSkeleton
              label='正在加载分享链接'
              className='px-0'
              rows={2}
            />
          ) : display?.error ? (
            <div
              role='alert'
              className='flex items-center justify-between gap-3 py-2'
            >
              <p className='min-w-0 text-sm text-destructive'>
                {display.error}
              </p>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={onRetryShares}
              >
                <RefreshCcw data-icon='inline-start' />
                重试
              </Button>
            </div>
          ) : display?.shares.length === 0 ? (
            <p className='py-3 text-sm text-muted-foreground'>
              还没有分享链接，生成后会显示在这里。
            </p>
          ) : null}
        </AnimatedContent>
        <div className='min-w-0 divide-y divide-border'>
          <AnimatePresence initial={false} mode='popLayout'>
            {display?.shares.map((share) => (
              <LinkRow
                key={share.id}
                share={share}
                busy={pendingShareIds.includes(share.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      </section>
    </div>
  )
}
