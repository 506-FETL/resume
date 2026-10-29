import type React from 'react'
import type { RoughAnnotation } from 'rough-notation/lib/model'
import { useInView } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useEffect, useRef } from 'react'
import { annotate } from 'rough-notation'
import { DURATION } from '@/lib/motion'

type AnnotationAction =
  | 'highlight'
  | 'underline'
  | 'box'
  | 'circle'
  | 'strike-through'
  | 'crossed-off'
  | 'bracket'

interface HighlighterProps {
  children: React.ReactNode
  action?: AnnotationAction
  color?: string
  strokeWidth?: number
  animationDuration?: number
  /** 显式指定时覆盖系统动效偏好；未指定时遵循减少动效设置。 */
  animate?: boolean
  iterations?: number
  padding?: number
  multiline?: boolean
  isView?: boolean
}

export function Highlighter({
  children,
  action = 'highlight',
  color = '#ffd1dc',
  strokeWidth = 1.5,
  animationDuration = DURATION.slow * 1000,
  animate,
  iterations = 2,
  padding = 2,
  multiline = true,
  isView = false,
}: HighlighterProps) {
  const reduceMotion = useReducedMotion()
  const shouldAnimate = animate ?? !reduceMotion
  const elementRef = useRef<HTMLSpanElement>(null)
  const annotationRef = useRef<RoughAnnotation | null>(null)

  const isInView = useInView(elementRef, {
    once: true,
    margin: '-10%',
  })

  // If isView is false, always show. If isView is true, wait for inView
  const shouldShow = !isView || isInView

  useEffect(() => {
    if (!shouldShow) return

    const element = elementRef.current

    if (!element) return

    const annotationConfig = {
      type: action,
      color,
      strokeWidth,
      animationDuration: shouldAnimate ? animationDuration : 0,
      animate: shouldAnimate,
      iterations,
      padding,
      multiline,
    }

    const annotation = annotate(element, annotationConfig)

    annotationRef.current = annotation
    annotationRef.current.show()

    let hasObservedInitialSize = false

    const resizeObserver = new ResizeObserver(() => {
      if (!hasObservedInitialSize) {
        hasObservedInitialSize = true

        return
      }

      annotation.animate = false
      annotation.hide()
      annotation.show()
    })

    resizeObserver.observe(element)
    resizeObserver.observe(document.body)

    return () => {
      if (element) {
        annotation.remove()
        resizeObserver.disconnect()
      }
    }
  }, [
    shouldShow,
    action,
    color,
    strokeWidth,
    animationDuration,
    iterations,
    padding,
    multiline,
    shouldAnimate,
  ])

  return (
    <span ref={elementRef} className='relative inline-block bg-transparent'>
      {children}
    </span>
  )
}
