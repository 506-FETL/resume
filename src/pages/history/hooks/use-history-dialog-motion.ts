import type { RefObject } from 'react'
import { useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { DURATION, EASE, SPRING } from '@/lib/motion'
import { cn } from '@/lib/utils'

const enterEase = `cubic-bezier(${EASE.out.join(',')})`
const exitEase = `cubic-bezier(${EASE.in.join(',')})`

// Radix Presence needs a closing animation to keep the node mounted. Visual
// properties use transitions so reopening midway continues from their current values.
const styles = `
@keyframes history-dialog-presence {
  from { --history-dialog-presence: 0; }
  to { --history-dialog-presence: 1; }
}
.history-modal-motion[data-state], .history-overlay-motion[data-state] {
  animation: none;
  transition: opacity ${DURATION.base}s ${enterEase}, transform ${DURATION.slow}s ${enterEase};
}
.history-modal-motion[data-state="open"] { opacity: 1; transform: translateY(0) scale(1); }
.history-overlay-motion[data-state="open"] { opacity: 1; }
.history-modal-motion[data-state="closed"], .history-overlay-motion[data-state="closed"] {
  opacity: 0;
  pointer-events: none;
  transition-duration: ${DURATION.fast}s;
  transition-timing-function: ${exitEase};
  animation: history-dialog-presence ${DURATION.fast}s linear;
}
.history-modal-motion[data-state="closed"] { transform: translateY(6px) scale(.98); }
@starting-style {
  .history-modal-motion[data-state="open"] { opacity: 0; transform: translateY(8px) scale(.96); }
  .history-overlay-motion[data-state="open"] { opacity: 0; }
}
.history-modal-motion[data-slot="drawer-popup"], .history-overlay-motion[data-slot="drawer-overlay"] {
  transition-duration: ${DURATION.slow}s;
  transition-timing-function: ${enterEase};
}
.history-modal-motion[data-starting-style], .history-modal-motion[data-ending-style] { opacity: 0; }
.history-modal-motion[data-swiping], .history-overlay-motion[data-swiping] { transition-duration: 0s; }
.history-modal-motion[data-ending-style], .history-overlay-motion[data-ending-style] {
  transition-duration: ${DURATION.fast}s;
  transition-timing-function: ${exitEase};
}
.history-dialog-reduced { animation: none !important; transition-duration: 0s !important; }
.history-dialog-reduced *, .history-dialog-reduced *::before, .history-dialog-reduced *::after {
  animation-duration: 0s !important;
  transition-duration: 0s !important;
  scroll-behavior: auto !important;
}
`

export function useHistoryDialogMotion() {
  const reduceMotion = useReducedMotion()

  return {
    reduceMotion,
    styles,
    contentClassName: cn(
      'history-modal-motion',
      reduceMotion && 'history-dialog-reduced',
    ),
    overlayClassName: cn(
      'history-overlay-motion',
      reduceMotion && 'history-dialog-reduced',
    ),
    enterTransition: {
      duration: reduceMotion ? 0 : DURATION.base,
      ease: EASE.out,
    },
    exitTransition: {
      duration: reduceMotion ? 0 : DURATION.fast,
      ease: EASE.in,
    },
    layoutTransition: reduceMotion ? { duration: 0 } : SPRING.layout,
  }
}

export function useHistoryDialogCloseReset(
  open: boolean,
  reset: () => void,
  elementRef: RefObject<HTMLElement | null>,
) {
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (open) return

    const content = elementRef.current?.closest(
      '[data-slot="dialog-content"], [data-slot="alert-dialog-content"], [data-slot="drawer-popup"]',
    )
    let frame = 0
    const afterExit = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(reset)
    }
    const onAnimationEnd = (event: Event) => {
      if (
        event.target === content &&
        (event as AnimationEvent).animationName === 'history-dialog-presence'
      )
        afterExit()
    }
    const onTransitionEnd = (event: Event) => {
      if (
        content?.getAttribute('data-slot') === 'drawer-popup' &&
        event.target === content &&
        (event as TransitionEvent).propertyName === 'transform'
      )
        afterExit()
    }

    // Follow the actual exit completion instead of racing a timer against a busy frame.
    if (reduceMotion || !content) {
      afterExit()
    } else {
      content.addEventListener('animationend', onAnimationEnd)
      content.addEventListener('transitionend', onTransitionEnd)
    }

    return () => {
      cancelAnimationFrame(frame)
      content?.removeEventListener('animationend', onAnimationEnd)
      content?.removeEventListener('transitionend', onTransitionEnd)
    }
  }, [open, reduceMotion, reset, elementRef])
}
