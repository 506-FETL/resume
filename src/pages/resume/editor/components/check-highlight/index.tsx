import type { RefObject } from 'react'
import type { CheckGeometry } from '../../utils/check-geometry'
import { AnimatePresence } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useEffect, useRef, useState } from 'react'
import { useResumeReviewStore } from '../../review-store'
import { useResumeCheckStore } from '../../store/checks'
import { locateCheckGeometry } from '../../utils/check-geometry'
import CheckOutline from './outline'

export default function CheckHighlight({
  enabled,
  rootRef,
  scrollRef,
}: {
  enabled: boolean
  rootRef: RefObject<HTMLDivElement | null>
  scrollRef: RefObject<HTMLDivElement | null>
}) {
  const state = useResumeCheckStore()
  const review = useResumeReviewStore((value) => value.active)
  const reduced = useReducedMotion()

  const [measurement, setMeasurement] = useState<
    (CheckGeometry & { key: string }) | null
  >(null)

  const scrolledRef = useRef('')
  const issue = state.issues.find((item) => item.id === state.selectedIssueId)

  const visible =
    enabled &&
    state.tab === 'checks' &&
    !review &&
    !!issue &&
    (state.filter === 'resolved'
      ? issue.resolved
      : !issue.resolved &&
        (state.filter === 'all' || state.filter === issue.severity))

  const target = visible ? issue?.targets[state.selectedTargetIndex] : undefined
  const targetKey = JSON.stringify(target)
  const locationKey = `${state.identity}:${state.locationVersion}:${issue?.severity}:${targetKey}`

  useEffect(() => {
    const root = rootRef.current
    const scroller = scrollRef.current

    if (!root || !scroller || !target || review || !state.selectedIssueId) {
      setMeasurement(null)
      scrolledRef.current = ''

      return
    }

    let frame = 0
    let cancelled = false

    const measure = () => {
      if (cancelled) return

      const next = locateCheckGeometry(root, scroller, target)

      setMeasurement((previous) =>
        previous?.key === locationKey && sameGeometry(previous, next)
          ? previous
          : { key: locationKey, ...next },
      )

      if (next.rects.length > 0 && scrolledRef.current !== locationKey) {
        scrolledRef.current = locationKey

        scroller.scrollTo({
          top: Math.max(0, next.rects[0].y - scroller.clientHeight * 0.35),
          behavior: reduced ? 'instant' : 'smooth',
        })
      }

      useResumeCheckStore.setState({
        locationMessage: next.rects.length
          ? null
          : target.quote
            ? '预览中未找到这段原文，可前往填写栏查看。'
            : '这处内容尚未填写，可直接前往补充。',
      })
    }

    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }

    const resize = new ResizeObserver(schedule)
    const mutation = new MutationObserver(schedule)

    resize.observe(root)
    resize.observe(scroller)

    mutation.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    })

    schedule()

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      resize.disconnect()
      mutation.disconnect()
    }
    // 以稳定的目标内容和定位请求驱动，排版变化由观察器更新。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, locationKey, review, reduced, rootRef, scrollRef])

  return (
    <AnimatePresence mode='wait'>
      {target && issue && measurement?.key === locationKey && (
        <CheckOutline
          key={locationKey}
          geometry={measurement}
          severity={issue.severity}
          scrollRef={scrollRef}
        />
      )}
    </AnimatePresence>
  )
}

function sameGeometry(previous: CheckGeometry, next: CheckGeometry) {
  return (
    JSON.stringify(previous.rects) === JSON.stringify(next.rects) &&
    previous.text.length === next.text.length &&
    previous.text.every(({ range, color }, index) => {
      const other = next.text[index]

      return (
        color === other.color &&
        range.startContainer === other.range.startContainer &&
        range.startOffset === other.range.startOffset &&
        range.endContainer === other.range.endContainer &&
        range.endOffset === other.range.endOffset
      )
    })
  )
}
