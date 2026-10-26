import type { RefObject } from 'react'
import type { CheckRect } from '../../utils/check-geometry'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Highlighter } from '@/components/ui/highlighter'
import { DURATION, EASE } from '@/lib/motion'
import { useResumeReviewStore } from '../../review-store'
import { useResumeCheckStore } from '../../store/checks'
import { locateCheckRects } from '../../utils/check-geometry'
import { CHECK_LEVELS } from '../../utils/check-presentation'

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

  const [measurement, setMeasurement] = useState<{
    key: string
    rects: CheckRect[]
  } | null>(null)

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
  const locationKey = `${state.identity}:${state.locationVersion}:${targetKey}`

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

      const next = locateCheckRects(root, scroller, target)

      setMeasurement((previous) =>
        previous?.key === locationKey &&
        JSON.stringify(previous.rects) === JSON.stringify(next)
          ? previous
          : { key: locationKey, rects: next },
      )

      if (next.length > 0 && scrolledRef.current !== locationKey) {
        scrolledRef.current = locationKey

        scroller.scrollTo({
          top: Math.max(0, next[0].y - scroller.clientHeight * 0.35),
          behavior: reduced ? 'instant' : 'smooth',
        })
      }

      useResumeCheckStore.setState({
        locationMessage: next.length
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
    <AnimatePresence>
      {target && issue && measurement?.key === locationKey && (
        <motion.div
          aria-hidden
          key={locationKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : DURATION.fast, ease: EASE.out }}
          className='pointer-events-none absolute inset-0 z-10 overflow-visible mix-blend-multiply print:hidden'
          data-resume-check-highlight
          data-severity={issue.severity}
        >
          {measurement.rects.map((rect) => (
            <div
              key={`${locationKey}:${rect.id}`}
              className='absolute leading-none'
              style={{
                left: rect.x,
                top: rect.y,
                width: rect.width,
                height: rect.height,
              }}
            >
              <Highlighter
                action='highlight'
                color={CHECK_LEVELS[issue.severity].highlight}
                animate
                padding={0}
                iterations={1}
              >
                <span
                  className='block'
                  style={{ width: rect.width, height: rect.height }}
                />
              </Highlighter>
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
