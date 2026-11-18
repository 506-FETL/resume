import { lazy, Suspense, useEffect, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { SIDEBAR_WIDTH_MOBILE, useSidebar } from '../sidebar-context'
import type { MobileSidebarProps } from './types'

const load = () => import('./index')

export function MobileSidebarDeferred(props: MobileSidebarProps) {
  const { openMobile } = useSidebar()
  const [hasOpened, setHasOpened] = useState(false)
  const [Content, setContent] = useState(() => lazy(load))

  useEffect(() => {
    if (openMobile) setHasOpened(true)
  }, [openMobile])

  if (!openMobile && !hasOpened) return null

  return (
    <ErrorBoundary
      onReset={() => setContent(() => lazy(load))}
      fallbackRender={({ resetErrorBoundary }) => (
        <MobileNavigationLoading
          side={props.side}
          onRetry={resetErrorBoundary}
        />
      )}
    >
      <Suspense fallback={<MobileNavigationLoading side={props.side} />}>
        <Content {...props} />
      </Suspense>
    </ErrorBoundary>
  )
}

function MobileNavigationLoading({
  side,
  onRetry,
}: {
  side: MobileSidebarProps['side']
  onRetry?: () => void
}) {
  const { openMobile, setOpenMobile, mobileTriggerRef } = useSidebar()

  return (
    <Dialog open={openMobile} onOpenChange={setOpenMobile}>
      <DialogContent
        className={cn(
          'top-2 bottom-2 max-w-[calc(100vw-1rem)] translate-x-0 translate-y-0 content-start',
          side === 'left' ? 'left-2' : 'right-2 left-auto',
        )}
        style={{ width: SIDEBAR_WIDTH_MOBILE }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()

          if (!openMobile)
            mobileTriggerRef.current?.focus({ preventScroll: true })
        }}
      >
        <DialogHeader>
          <DialogTitle>主导航</DialogTitle>
          <DialogDescription>
            {onRetry ? '导航暂时无法打开，请重试。' : '正在加载导航…'}
          </DialogDescription>
        </DialogHeader>
        {onRetry ? (
          <Button variant='outline' onClick={onRetry}>
            重试
          </Button>
        ) : (
          <div aria-busy='true' className='space-y-3'>
            {[0, 1, 2, 3, 4].map((item) => (
              <Skeleton key={item} className='h-8 w-full' />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
