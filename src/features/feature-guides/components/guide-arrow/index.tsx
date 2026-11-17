import { autoUpdate } from '@floating-ui/react'
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
  onDrawn,
}: {
  target: HTMLElement | null
  popover: HTMLElement | null
  active: boolean
  onDrawn: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const strokeRef = useRef<SVGPathElement>(null)
  const tipRef = useRef<SVGPathElement>(null)
  const progressRef = useRef({ value: 0 })
  const onDrawnRef = useRef(onDrawn)
  const locatedRef = useRef(false)

  onDrawnRef.current = onDrawn

  const [located, setLocated] = useState(false)

  const reduced = useReducedMotion()

  useLayoutEffect(() => {
    if (!target || !popover || !active) return

    const anchor =
      popover.closest<HTMLElement>('[data-radix-popper-content-wrapper]') ??
      popover

    const update = () => {
      const placement = getArrowPlacement(
        target.getBoundingClientRect(),
        anchor.getBoundingClientRect(),
      )

      svgRef.current!.style.transform = `translate3d(${placement.x - 36}px, ${placement.y - 17}px, 0) rotate(${placement.angle}deg)`

      if (!locatedRef.current) {
        locatedRef.current = true
        setLocated(true)
      }
    }

    const stop = autoUpdate(target, anchor, update, { animationFrame: true })
    const observer = new MutationObserver(update)

    observer.observe(anchor, { attributes: true, attributeFilter: ['style'] })

    return () => {
      stop()
      observer.disconnect()
    }
  }, [target, popover, active])

  useGSAP(
    () => {
      const root = rootRef.current
      const progress = progressRef.current

      if (!root) return

      gsap.killTweensOf(progress)

      if (active && located) {
        const stroke = strokeRef.current!
        const tip = tipRef.current!
        const length = stroke.getTotalLength()

        gsap.to(root, {
          autoAlpha: 1,
          duration: reduced ? 0 : DURATION.base,
          ease: guideEnterEase,
          overwrite: true,
        })

        gsap.to(progress, {
          value: 1,
          duration: reduced
            ? 0
            : (1 - progress.value) * (DURATION.slow + DURATION.base),
          ease: guideEnterEase,
          onComplete: () => onDrawnRef.current(),
          onUpdate: () => {
            const distance = length * progress.value
            const point = stroke.getPointAtLength(distance)
            const before = stroke.getPointAtLength(Math.max(0, distance - 0.5))

            const after = stroke.getPointAtLength(
              Math.min(length, distance + 0.5),
            )

            const angle =
              (Math.atan2(after.y - before.y, after.x - before.x) * 180) /
              Math.PI

            stroke.style.strokeDashoffset = String(1 - progress.value)

            tip.setAttribute(
              'transform',
              `translate(${point.x} ${point.y}) rotate(${angle})`,
            )
          },
        })
      } else {
        gsap.to(root, {
          autoAlpha: 0,
          duration: reduced ? 0 : DURATION.fast,
          ease: guideExitEase,
          overwrite: true,
          onComplete: () => {
            progress.value = 0
            locatedRef.current = false
            strokeRef.current!.style.strokeDashoffset = '1'
            setLocated(false)
          },
        })
      }
    },
    {
      scope: rootRef,
      dependencies: [active, located, reduced],
    },
  )

  return createPortal(
    <div
      ref={rootRef}
      data-feature-guide-ui
      aria-hidden
      className='feature-guide-arrow pointer-events-none fixed inset-0 z-70'
    >
      <svg
        ref={svgRef}
        data-feature-guide-arrow={located ? '' : undefined}
        viewBox='0 0 72 34'
        width={72}
        height={34}
        fill='none'
        stroke='currentColor'
        strokeWidth={1.25}
        strokeLinecap='round'
        strokeLinejoin='round'
        className='absolute top-0 left-0 text-muted-foreground'
      >
        <path
          ref={strokeRef}
          data-guide-arrow-stroke
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1}
          d='M 4 17
              C 4.7 15.7 9.6 13.9 13 14.4
              C 17.4 14.8 22.7 17.7 25.2 21.9
              C 27.2 24.2 27.1 25.8 25.1 26.9
              C 22.7 27.1 22.8 22.7 25.4 20.7
              C 28.5 18.7 35.1 17.9 38.2 20.2
              C 40.2 22.1 41 24 38.8 24.7
              C 36.4 25.1 37.1 19.6 39.2 17.8
              C 40.8 16.5 43.9 15.9 46 16
              C 48.7 16.4 49.1 19.7 47.9 21.2
              C 46.3 23.1 45.2 21.1 46.9 19.7
              C 49.2 15.8 54.6 14.1 58.3 14.4
              C 62 14.3 63.5 17 67.5 17'
        />
        <path ref={tipRef} data-guide-arrow-tip d='M -4 -3 L 0 0 L -4 3' />
      </svg>
    </div>,
    document.body,
  )
}
