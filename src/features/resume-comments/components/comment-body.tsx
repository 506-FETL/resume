import { ChevronDown } from 'lucide-react'
import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'

const COLLAPSED_LINES = 6

export function CommentBody({ body }: { body: string }) {
  const contentId = useId()
  const contentRef = useRef<HTMLParagraphElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<SVGSVGElement>(null)
  const fadeRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const [expanded, setExpanded] = useState(false)
  const [clamped, setClamped] = useState(true)

  const [measurement, setMeasurement] = useState<{
    height: number
    collapsedHeight: number
  } | null>(null)

  const parts = useMemo(() => {
    const result: Array<{ key: number; text: string; link: boolean }> = []
    const pattern = /https?:\/\/\S+|mailto:\S+/giu
    let cursor = 0

    for (const match of body.matchAll(pattern)) {
      const index = match.index

      if (index > cursor)
        result.push({
          key: cursor,
          text: body.slice(cursor, index),
          link: false,
        })

      result.push({ key: index, text: match[0], link: true })
      cursor = index + match[0].length
    }

    if (cursor < body.length)
      result.push({ key: cursor, text: body.slice(cursor), link: false })

    return result
  }, [body])

  useLayoutEffect(() => {
    const content = contentRef.current!

    const measure = () => {
      const height = content.scrollHeight

      const collapsedHeight =
        Number.parseFloat(getComputedStyle(content).lineHeight) *
        COLLAPSED_LINES

      setMeasurement((current) =>
        current?.height === height &&
        current.collapsedHeight === collapsedHeight
          ? current
          : { height, collapsedHeight },
      )
    }

    const observer = new ResizeObserver(measure)

    observer.observe(content)
    measure()

    return () => observer.disconnect()
  }, [body])

  useLayoutEffect(() => {
    if (!reduceMotion) return

    // duration 归零不会结束浏览器已经启动的 CSS 过渡。
    for (const element of [
      viewportRef.current,
      indicatorRef.current,
      fadeRef.current,
    ]) {
      for (const animation of element?.getAnimations() ?? []) animation.finish()
    }

    setClamped(!expanded)
  }, [expanded, reduceMotion])

  const overflowing = Boolean(
    measurement && measurement.height > measurement.collapsedHeight,
  )

  const duration = reduceMotion ? 0 : expanded ? DURATION.base : DURATION.fast

  return (
    <div className='text-sm leading-6'>
      <div
        ref={viewportRef}
        id={contentId}
        className='relative overflow-hidden transition-[height]'
        style={{
          height: measurement
            ? expanded
              ? measurement.height
              : Math.min(measurement.height, measurement.collapsedHeight)
            : undefined,
          maxHeight: measurement ? undefined : `${COLLAPSED_LINES}lh`,
          transitionDuration: `${duration}s`,
          transitionTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
        }}
        onFocusCapture={() => {
          // 键盘进入被裁切的链接时先展开，避免焦点落在看不见的正文中。
          if (overflowing) {
            setClamped(false)
            setExpanded(true)
          }
        }}
        onTransitionEnd={(event) => {
          if (
            event.target === event.currentTarget &&
            event.propertyName === 'height'
          )
            setClamped(!expanded)
        }}
      >
        <p
          ref={contentRef}
          className={cn(
            'whitespace-pre-wrap wrap-break-word',
            clamped && 'line-clamp-6',
          )}
        >
          {parts.map((part) => {
            if (!part.link) return <span key={part.key}>{part.text}</span>

            try {
              const url = new URL(part.text)

              if (!['http:', 'https:', 'mailto:'].includes(url.protocol))
                return <span key={part.key}>{part.text}</span>

              return (
                <a
                  key={part.key}
                  href={url.href}
                  target={url.protocol === 'mailto:' ? undefined : '_blank'}
                  rel='noreferrer noopener'
                  className='text-primary underline underline-offset-2'
                >
                  {part.text}
                </a>
              )
            } catch {
              return <span key={part.key}>{part.text}</span>
            }
          })}
        </p>
        {overflowing ? (
          <div
            ref={fadeRef}
            aria-hidden
            className='pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-background/30 backdrop-blur-[1px] transition-opacity [mask-image:linear-gradient(to_right,transparent_20%,black_90%)]'
            style={{
              opacity: expanded ? 0 : 1,
              transitionDuration: `${duration}s`,
              transitionTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
            }}
          />
        ) : null}
      </div>
      {overflowing ? (
        <Button
          type='button'
          size='sm'
          variant='link'
          className='mt-1 h-7 gap-1 p-0 text-xs'
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => {
            if (!expanded) setClamped(false)

            setExpanded((current) => !current)
          }}
        >
          {expanded ? '收起' : '展开全文'}
          <ChevronDown
            ref={indicatorRef}
            className={cn(
              'size-3.5 transition-transform',
              expanded && 'rotate-180',
            )}
            style={{
              transitionDuration: `${duration}s`,
              transitionTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
            }}
          />
        </Button>
      ) : null}
    </div>
  )
}
