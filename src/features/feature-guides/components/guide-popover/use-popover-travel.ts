import { useLayoutEffect, useRef } from 'react'
import { DURATION } from '@/lib/motion'
import { gsap, guideEnterEase, useGSAP } from '../../motion'

export function usePopoverTravel({
  element,
  card,
  index,
  present,
  reduced,
  onArrive,
}: {
  element: HTMLElement | null
  card: HTMLElement | null
  index: number
  present: boolean
  reduced: boolean
  onArrive: (index: number) => void
}) {
  const travelRef = useRef({ progress: 1, x: 0, y: 0 })
  const positionRef = useRef<{ x: number; y: number } | null>(null)
  const previousIndexRef = useRef(index)
  const updateRef = useRef(() => {})
  const presentRef = useRef(present)
  const callbackRef = useRef(onArrive)

  presentRef.current = present
  callbackRef.current = onArrive

  useLayoutEffect(() => {
    if (!element || !card) return

    const anchor = element.parentElement!

    const place = () => {
      if (!presentRef.current) return

      const bounds = anchor.getBoundingClientRect()
      const { progress, x, y } = travelRef.current
      const offsetX = (x - bounds.x) * (1 - progress)
      const offsetY = (y - bounds.y) * (1 - progress)

      card.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`
      positionRef.current = { x: bounds.x + offsetX, y: bounds.y + offsetY }
    }

    updateRef.current = place

    const observer = new MutationObserver(place)
    const resize = new ResizeObserver(place)

    observer.observe(anchor, { attributes: true, attributeFilter: ['style'] })
    resize.observe(element)
    place()

    return () => {
      observer.disconnect()
      resize.disconnect()
    }
  }, [element, card])

  useGSAP(
    () => {
      const state = travelRef.current

      gsap.killTweensOf(state)

      if (!element || !card || !present || !positionRef.current) return

      if (index !== previousIndexRef.current) {
        previousIndexRef.current = index
        state.x = positionRef.current.x
        state.y = positionRef.current.y
        state.progress = 0
      } else if (state.progress === 1) return

      updateRef.current()

      gsap.to(state, {
        progress: 1,
        duration: reduced ? 0 : (1 - state.progress) * DURATION.slow,
        ease: guideEnterEase,
        onUpdate: () => updateRef.current(),
        onComplete: () => callbackRef.current(index),
      })
    },
    { dependencies: [element, card, index, present, reduced] },
  )
}
