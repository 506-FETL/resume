import { autoUpdate } from '@floating-ui/react'
import { Quote } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useLayoutEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION } from '@/lib/motion'
import { gsap, guideEnterEase, guideExitEase, useGSAP } from '../motion'

export default function ReferenceDemo({
  visible,
  quote,
  onReady,
}: {
  visible: boolean
  quote: string
  onReady: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const callbackRef = useRef(onReady)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const reduced = useReducedMotion()

  callbackRef.current = onReady

  useLayoutEffect(() => {
    const composer = document.querySelector<HTMLElement>('[data-composer]')
    const root = rootRef.current

    if (!visible || !composer || !root) return

    return autoUpdate(composer, root, () =>
      setRect(composer.getBoundingClientRect()),
    )
  }, [visible])

  useGSAP(
    () => {
      const root = rootRef.current

      if (!root || !rect) return

      if (!visible) {
        gsap.to(root, {
          autoAlpha: 0,
          y: reduced ? 0 : 4,
          duration: reduced ? 0 : DURATION.fast,
          ease: guideExitEase,
        })

        return
      }

      const timeline = gsap.timeline({
        defaults: {
          ease: guideEnterEase,
          duration: reduced ? 0 : DURATION.base,
        },
      })

      timeline
        .fromTo(
          root,
          { autoAlpha: 0, y: reduced ? 0 : 8 },
          { autoAlpha: 1, y: 0 },
        )
        .fromTo(
          '[data-guide-quote-tag]',
          { opacity: 0, scale: reduced ? 1 : 0.96 },
          { opacity: 1, scale: 1 },
          '<',
        )
        .fromTo(
          '[data-guide-question]',
          { opacity: 0, y: reduced ? 0 : 4 },
          { opacity: 1, y: 0 },
        )
        .call(() => callbackRef.current())
    },
    {
      scope: rootRef,
      dependencies: [visible, Boolean(rect), reduced],
      revertOnUpdate: true,
    },
  )

  return createPortal(
    <div
      ref={rootRef}
      data-feature-guide-ui
      data-feature-guide-demo='reference'
      aria-hidden={!visible}
      className='pointer-events-none fixed z-60 space-y-2 rounded-xl bg-popover p-3 shadow-sm ring-1 ring-border'
      style={{
        visibility: 'hidden',
        left: rect ? Math.max(12, rect.left) : 12,
        bottom: rect ? Math.max(12, window.innerHeight - rect.top + 12) : 12,
        width: rect ? Math.min(320, rect.width, window.innerWidth - 24) : 280,
      }}
    >
      <div className='flex items-center justify-between text-xs text-muted-foreground'>
        <span>引用到输入区</span>
        <Badge variant='secondary' className='text-[10px]'>
          演示
        </Badge>
      </div>
      <div
        data-guide-quote-tag
        className='flex items-start gap-2 rounded-lg bg-muted/60 p-2.5 text-xs'
      >
        <Quote className='mt-0.5 size-3.5 shrink-0 text-muted-foreground' />
        <p className='line-clamp-2 leading-5'>{quote}</p>
      </div>
      <p data-guide-question className='text-sm'>
        帮我把这段写得更简洁
      </p>
    </div>,
    document.body,
  )
}
