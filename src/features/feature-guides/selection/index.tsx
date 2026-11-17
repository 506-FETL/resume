import type { GuideRect, GuideSelection } from './types'
import { autoUpdate } from '@floating-ui/react'
import { MousePointer2 } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION } from '@/lib/motion'
import { guideEnterEase, guideExitEase, gsap, useGSAP } from '../motion'
import { readGuideRects } from './geometry'

export type { GuideSelection } from './types'

interface SelectionDemoProps {
  selection: GuideSelection
  phase: 'select' | 'action' | 'highlight'
  actionLabel: string
  onAction: () => void
  onReady: () => void
  visible?: boolean
  playing?: boolean
  onUnavailable?: () => void
}

export default function SelectionDemo({
  selection,
  phase,
  actionLabel,
  onAction,
  onReady,
  visible = true,
  playing = true,
  onUnavailable,
}: SelectionDemoProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const actionRef = useRef<HTMLDivElement>(null)
  const onReadyRef = useRef(onReady)
  const onUnavailableRef = useRef(onUnavailable)
  const unavailableRef = useRef(false)
  const readyRef = useRef(false)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const [rects, setRects] = useState<GuideRect[]>([])
  const [selectionComplete, setSelectionComplete] = useState(false)
  const reduced = useReducedMotion()
  const bounds = getBounds(rects)

  const actionShown =
    (phase === 'action' || (phase === 'select' && selectionComplete)) && visible

  const shape = rects
    .map((rect) =>
      [rect.left - bounds.left, rect.top - bounds.top, rect.width, rect.height]
        .map(Math.round)
        .join(':'),
    )
    .join('|')

  onReadyRef.current = onReady
  onUnavailableRef.current = onUnavailable

  useLayoutEffect(() => {
    readyRef.current = false
    setSelectionComplete(false)
  }, [selection, phase])

  useLayoutEffect(() => {
    const root = rootRef.current

    if (!root || !visible) return

    unavailableRef.current = false

    const update = () => {
      const nextRects = readGuideRects(selection)

      setRects((previous) =>
        JSON.stringify(previous) === JSON.stringify(nextRects)
          ? previous
          : nextRects,
      )

      if (nextRects.length === 0 && !unavailableRef.current) {
        unavailableRef.current = true
        onUnavailableRef.current?.()
      }
    }

    const stop = autoUpdate(
      {
        contextElement: selection.element,
        getBoundingClientRect: () => selection.range.getBoundingClientRect(),
      },
      root,
      update,
    )

    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)

    return () => {
      stop()
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
    }
  }, [selection, visible])

  useGSAP(
    () => {
      const root = rootRef.current
      const cursor = cursorRef.current
      const lines = root?.querySelectorAll('[data-guide-selection-line]')

      timelineRef.current?.kill()

      if (!root || !cursor || !lines?.length || !visible) return

      gsap.set(lines, { transformOrigin: 'left center' })
      gsap.set(cursor, { opacity: 0 })

      if (phase === 'highlight') {
        gsap.fromTo(
          lines,
          { backgroundColor: 'rgba(96,165,250,0.3)' },
          {
            scaleX: 1,
            backgroundColor: 'rgba(252,211,77,0.35)',
            duration: reduced ? 0 : DURATION.base,
            ease: guideEnterEase,
          },
        )
      }

      if (phase !== 'select' || readyRef.current) return
      if (!playing) {
        gsap.set(lines, { scaleX: 0 })

        return
      }
      if (reduced) {
        gsap.set(lines, { scaleX: 1 })
        readyRef.current = true
        setSelectionComplete(true)
        onReadyRef.current()

        return
      }

      const bounds = getBounds(rects)
      const lineDuration = DURATION.slow * 3

      gsap.set(lines, { scaleX: 0 })

      const timeline = gsap.timeline({
        defaults: { duration: lineDuration, ease: guideEnterEase },
        onComplete: () => {
          readyRef.current = true
          setSelectionComplete(true)
          onReadyRef.current()
        },
      })

      timelineRef.current = timeline

      rects.forEach((rect, index) => {
        const start = DURATION.base + index * lineDuration
        const y = rect.top - bounds.top + rect.height * 0.6

        timeline.set(
          cursor,
          { opacity: 1, x: rect.left - bounds.left, y },
          index === 0 ? 0 : start,
        )

        timeline.to(lines[index], { scaleX: 1 }, start)

        timeline.to(
          cursor,
          { x: rect.left - bounds.left + rect.width, y },
          start,
        )
      })

      timeline.to(
        cursor,
        { opacity: 0, duration: DURATION.fast },
        `+=${DURATION.slow}`,
      )
    },
    {
      scope: rootRef,
      dependencies: [selection, phase, reduced, shape, visible, playing],
    },
  )

  useGSAP(
    () => {
      gsap.to(rootRef.current, {
        opacity: visible ? 1 : 0,
        duration: reduced ? 0 : visible ? DURATION.base : DURATION.fast,
        ease: visible ? guideEnterEase : guideExitEase,
        overwrite: true,
      })

      if (actionShown) {
        gsap.fromTo(
          actionRef.current,
          { opacity: 0, y: reduced ? 0 : 8 },
          {
            opacity: 1,
            y: 0,
            duration: reduced ? 0 : DURATION.base,
            ease: guideEnterEase,
          },
        )
      } else {
        gsap.to(actionRef.current, {
          opacity: 0,
          y: reduced ? 0 : 4,
          duration: reduced ? 0 : DURATION.fast,
          ease: guideExitEase,
          overwrite: true,
        })
      }
    },
    {
      scope: rootRef,
      dependencies: [visible, actionShown, reduced],
    },
  )

  const actionTop = bounds.top > 52 ? -44 : bounds.height + 8

  const actionLeft = Math.max(
    8 - bounds.left,
    Math.min(0, innerWidth - bounds.left - 168),
  )

  return createPortal(
    <div
      ref={rootRef}
      data-feature-guide-ui
      className='pointer-events-none fixed z-[61] print:hidden'
      style={{ ...bounds, visibility: rects.length ? 'visible' : 'hidden' }}
    >
      <div
        data-feature-guide-selection={visible ? '' : undefined}
        className='absolute inset-0'
      />
      {rects.map((rect) => (
        <div
          key={`${Math.round(rect.top - bounds.top)}-${Math.round(rect.left - bounds.left)}`}
          data-guide-selection-line
          className={
            phase === 'highlight'
              ? 'absolute rounded-[2px] bg-amber-300/35'
              : 'absolute rounded-[2px] bg-blue-400/30'
          }
          style={{
            left: rect.left - bounds.left,
            top: rect.top - bounds.top,
            width: rect.width,
            height: rect.height,
          }}
        />
      ))}
      <div
        ref={cursorRef}
        aria-hidden
        className='absolute top-0 left-0 text-blue-600'
      >
        <MousePointer2 className='size-5 fill-background drop-shadow-sm' />
      </div>
      <div
        ref={actionRef}
        aria-hidden={!actionShown}
        inert={!actionShown}
        className='absolute left-0'
        style={{ top: actionTop, left: actionLeft, opacity: 0 }}
      >
        <Button
          size='sm'
          className='pointer-events-auto shadow-md'
          disabled={!actionShown}
          tabIndex={actionShown ? 0 : -1}
          style={{ pointerEvents: actionShown ? 'auto' : 'none' }}
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      </div>
    </div>,
    document.body,
  )
}

function getBounds(rects: GuideRect[]): GuideRect {
  if (rects.length === 0) return { left: 0, top: 0, width: 0, height: 0 }

  const left = Math.min(...rects.map((rect) => rect.left))
  const top = Math.min(...rects.map((rect) => rect.top))

  return {
    left,
    top,
    width: Math.max(...rects.map((rect) => rect.left + rect.width)) - left,
    height: Math.max(...rects.map((rect) => rect.top + rect.height)) - top,
  }
}
