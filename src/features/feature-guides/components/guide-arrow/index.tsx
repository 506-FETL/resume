import { autoUpdate } from '@floating-ui/react'
import { ArrowRight } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useLayoutEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION } from '@/lib/motion'
import { gsap, useGSAP, guideEnterEase, guideExitEase } from '../../motion'
import { getArrowPlacement } from './placement'

export default function GuideArrow({
  target,
  popover,
  active,
}: {
  target: HTMLElement | null
  popover: HTMLElement | null
  active: boolean
}) {
  const rootRef = useRef<HTMLDivElement>(null)

  const [placement, setPlacement] = useState<ReturnType<
    typeof getArrowPlacement
  > | null>(null)

  const reduced = useReducedMotion()

  useLayoutEffect(() => {
    if (!target || !popover || !active) return

    return autoUpdate(target, popover, () => {
      setPlacement(
        getArrowPlacement(
          target.getBoundingClientRect(),
          popover.getBoundingClientRect(),
        ),
      )
    })
  }, [target, popover, active])

  useGSAP(
    () => {
      const root = rootRef.current

      if (!root) return

      if (active && placement) {
        gsap.fromTo(
          root,
          { autoAlpha: 0, y: reduced ? 0 : 2 },
          {
            autoAlpha: 1,
            y: 0,
            duration: reduced ? 0 : DURATION.base,
            ease: guideEnterEase,
          },
        )
      } else {
        gsap.to(root, {
          autoAlpha: 0,
          duration: reduced ? 0 : DURATION.fast,
          ease: guideExitEase,
        })
      }
    },
    {
      scope: rootRef,
      dependencies: [active, Boolean(placement), reduced],
      revertOnUpdate: true,
    },
  )

  return createPortal(
    <div
      ref={rootRef}
      data-feature-guide-ui
      aria-hidden
      className='pointer-events-none fixed inset-0 z-70'
      style={{ visibility: 'hidden' }}
    >
      {placement && (
        <ArrowRight
          data-feature-guide-arrow
          strokeWidth={1.5}
          className='absolute size-4 text-muted-foreground'
          style={{
            left: placement.x - 8,
            top: placement.y - 8,
            transform: `rotate(${placement.angle}deg)`,
          }}
        />
      )}
    </div>,
    document.body,
  )
}
