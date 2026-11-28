import { useEffect, useEffectEvent, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useDelayedBusy } from '@/hooks/use-delayed-busy'
import { cn } from '@/lib/utils'

export function OpeningFeedback({
  title,
  opener,
  onClose,
  onRetry,
}: {
  title: string
  opener: HTMLElement | null
  onClose: () => void
  onRetry?: () => void
}) {
  const feedbackRef = useRef<HTMLDivElement>(null)
  const showPending = useDelayedBusy(!onRetry)
  const cancel = useEffectEvent(onClose)

  const parentDialog = opener?.closest<HTMLElement>(
    '[role="dialog"], [role="alertdialog"]',
  )

  const label = onRetry ? `暂时无法打开「${title}」` : `正在打开「${title}」`

  function close() {
    if (opener?.isConnected) opener.focus({ preventScroll: true })

    onClose()
  }

  const escape = useEffectEvent(close)

  useEffect(() => {
    function handleInteraction(event: KeyboardEvent | PointerEvent) {
      if (event instanceof KeyboardEvent) {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          escape()

          return
        }
        if (event.key !== 'Enter' && event.key !== ' ') return
      }

      // 用户开始另一项操作后，迟到的浮层不能再抢走焦点。
      const target = event.target

      if (
        target instanceof Node &&
        !opener?.contains(target) &&
        !feedbackRef.current?.contains(target)
      )
        cancel()
    }

    window.addEventListener('keydown', handleInteraction, true)
    window.addEventListener('pointerdown', handleInteraction, true)

    return () => {
      window.removeEventListener('keydown', handleInteraction, true)
      window.removeEventListener('pointerdown', handleInteraction, true)
    }
  }, [opener])

  if (!showPending && !onRetry)
    return (
      <span className='sr-only' role='status'>
        {label}
      </span>
    )

  return createPortal(
    <Alert
      ref={feedbackRef}
      role={onRetry ? 'alert' : 'status'}
      className={cn(
        'inset-x-3 bottom-3 z-50 mx-auto flex w-fit max-w-[calc(100%-1.5rem)] items-center gap-2 px-3 py-2 shadow-sm',
        parentDialog ? 'absolute' : 'fixed',
      )}
    >
      <span>{label}</span>
      {onRetry && (
        <Button type='button' variant='outline' size='sm' onClick={onRetry}>
          重试
        </Button>
      )}
      <Button type='button' size='sm' variant='ghost' onClick={close}>
        取消
      </Button>
    </Alert>,
    parentDialog?.isConnected ? parentDialog : document.body,
  )
}
