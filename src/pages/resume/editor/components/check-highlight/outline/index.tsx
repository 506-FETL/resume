import type { RefObject } from 'react'
import type { CheckSeverity } from '@/lib/resume-checks/types'
import type { CheckGeometry } from '../../../utils/check-geometry'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { usePresence } from 'motion/react'
import { useId, useLayoutEffect, useMemo, useRef } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import { CHECK_LEVELS } from '../../../utils/check-presentation'

gsap.registerPlugin(useGSAP, CustomEase)

const enterEase = CustomEase.create('check-outline-enter', EASE.out.join(','))
const exitEase = CustomEase.create('check-outline-exit', EASE.in.join(','))

export default function CheckOutline({
  geometry,
  severity,
  scrollRef,
}: {
  geometry: CheckGeometry
  severity: CheckSeverity
  scrollRef: RefObject<HTMLDivElement | null>
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const name = `resume-check-${id}`
  const tintProperty = `--${name}-tint`
  const ink = CHECK_LEVELS[severity].previewInk
  const reduced = useReducedMotion()
  const [present, safeToRemove] = usePresence()

  const textGroups = useMemo(() => {
    const groups = new Map<string, Range[]>()

    geometry.text.forEach(({ range, color }) => {
      const ranges = groups.get(color) ?? []

      ranges.push(range)
      groups.set(color, ranges)
    })

    return Array.from(groups, ([color, ranges]) => ({ color, ranges }))
  }, [geometry.text])

  useLayoutEffect(() => {
    if (!CSS.highlights) return

    // 原文只登记文字范围，不包裹节点；测量和打印副本保持原样。
    const names = textGroups.map(({ ranges }, index) => {
      const key = `${name}-${index}`

      CSS.highlights.set(key, new Highlight(...ranges))

      return key
    })

    return () => {
      names.forEach((key) => CSS.highlights.delete(key))
    }
  }, [textGroups, name])

  useGSAP(
    () => {
      const root = rootRef.current
      const scroller = scrollRef.current

      if (!root || !scroller) return

      timelineRef.current?.kill()

      const timeline = gsap.timeline({
        defaults: {
          duration: reduced ? 0 : present ? DURATION.slow : DURATION.fast,
          ease: present ? enterEase : exitEase,
        },
        onComplete: () => {
          if (!present) safeToRemove?.()
        },
      })

      timeline
        .to(
          root,
          {
            ...(present ? { '--check-outline-draw': 1 } : {}),
            opacity: present ? 1 : 0,
          },
          0,
        )
        .to(scroller, { [tintProperty]: present ? '100%' : '0%' }, 0)

      timelineRef.current = timeline
    },
    { scope: rootRef, dependencies: [present, reduced] },
  )

  return (
    <div
      ref={rootRef}
      aria-hidden
      className='pointer-events-none absolute inset-0 z-10 overflow-visible print:hidden'
      style={{ opacity: 0, color: ink }}
      data-resume-check-highlight
      data-severity={severity}
    >
      <style>{`@media screen {${textGroups
        .map(
          ({ color }, index) => `::highlight(${name}-${index}) {
            color: color-mix(in srgb, ${color} calc(100% - var(${tintProperty}, 0%)), ${ink} var(${tintProperty}, 0%));
          }`,
        )
        .join('\n')}}`}</style>
      {geometry.rects.map((rect) => (
        <svg
          key={rect.id}
          className='absolute overflow-visible'
          width={rect.width + 8}
          height={rect.height + 4}
          style={{ left: rect.x - 4, top: rect.y - 2 }}
          fill='none'
        >
          <rect
            width={rect.width + 8}
            height={rect.height + 4}
            rx={4}
            pathLength={1}
            stroke='currentColor'
            strokeWidth={1.5}
            strokeDasharray={1}
            style={{
              strokeDashoffset: 'calc(1 - var(--check-outline-draw, 0))',
            }}
          />
        </svg>
      ))}
    </div>
  )
}
