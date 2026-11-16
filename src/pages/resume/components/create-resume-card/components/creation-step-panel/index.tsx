import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { CONTENT_SWITCH } from '@/lib/motion'
import { motion, useAnimationControls, usePresence } from 'motion/react'
import type { ReactNode } from 'react'
import { useEffect, useLayoutEffect, useRef } from 'react'

export function CreationStepPanel({
  children,
  className,
  measureRef,
  refreshBounds,
}: {
  children: ReactNode
  className: string
  measureRef: (element: HTMLDivElement | null) => void
  refreshBounds: () => void
}) {
  const reduceMotion = useReducedMotion()
  const [isPresent, safeToRemove] = usePresence()
  const controls = useAnimationControls()
  const panelRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(refreshBounds, [refreshBounds])

  useLayoutEffect(() => {
    const panel = panelRef.current

    if (!panel) return

    if (!isPresent && panel.contains(document.activeElement))
      panel.parentElement?.focus()

    panel.inert = !isPresent

    if (isPresent) panel.removeAttribute('aria-hidden')
    else panel.setAttribute('aria-hidden', 'true')
  }, [isPresent])

  useEffect(() => {
    let active = true

    const target = {
      opacity: isPresent ? 1 : 0,
      transform: 'translateY(0px)',
    }

    if (reduceMotion) {
      controls.set(target)

      if (!isPresent) safeToRemove?.()

      return
    }

    controls
      .start({
        ...target,
        transition: isPresent ? CONTENT_SWITCH.enter : CONTENT_SWITCH.exit,
      })
      .then(() => {
        if (active && !isPresent) safeToRemove?.()
      })

    return () => {
      active = false
      controls.stop()
    }
  }, [controls, isPresent, reduceMotion, safeToRemove])

  return (
    <motion.div
      ref={(node) => {
        panelRef.current = node
        measureRef(node)
      }}
      data-creation-layout
      className={className}
      initial={{
        opacity: reduceMotion ? 1 : 0,
        transform: `translateY(${reduceMotion ? 0 : 8}px)`,
      }}
      animate={controls}
    >
      {children}
    </motion.div>
  )
}
