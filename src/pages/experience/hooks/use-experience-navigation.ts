import { useLayoutEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useExperiencePageStore } from '../store'

export function useExperienceNavigation() {
  const detailOpen = useExperiencePageStore((state) => state.detailOpen)
  const sourceId = useExperiencePageStore((state) => state.sourceId)
  const listScroll = useExperiencePageStore((state) => state.listScroll)
  const reduced = useReducedMotion()
  const hostRef = useRef<HTMLDivElement>(null)
  const libraryRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)
  const [displayedDetail, setDisplayedDetail] = useState(detailOpen)
  const previousDetailRef = useRef(detailOpen)
  const displayed = reduced ? detailOpen : displayedDetail
  const exiting = displayed !== detailOpen

  useLayoutEffect(() => {
    if (reduced) setDisplayedDetail(detailOpen)
  }, [detailOpen, reduced])

  useLayoutEffect(() => {
    const library = libraryRef.current
    const detail = detailRef.current

    if (!library || !detail) return

    const libraryInteractive = !displayed && !exiting
    const detailInteractive = displayed && !exiting

    if (
      (!libraryInteractive && library.contains(document.activeElement)) ||
      (!detailInteractive && detail.contains(document.activeElement))
    )
      hostRef.current?.focus({ preventScroll: true })

    for (const [panel, interactive] of [
      [library, libraryInteractive],
      [detail, detailInteractive],
    ] as const) {
      panel.inert = !interactive

      if (interactive) panel.removeAttribute('aria-hidden')
      else panel.setAttribute('aria-hidden', 'true')
    }

    if (exiting) return

    if (
      previousDetailRef.current !== detailOpen ||
      document.activeElement === hostRef.current
    ) {
      if (detailOpen) backRef.current?.focus({ preventScroll: true })
      else {
        if (scrollRef.current) scrollRef.current.scrollTop = listScroll

        const target = sourceId
          ? library.querySelector<HTMLButtonElement>(
              `[data-source-id="${sourceId}"]`,
            )
          : null

        const fallback = library.querySelector<HTMLButtonElement>(
          '[data-experience-upload]',
        )

        if (target && !target.disabled) target.focus({ preventScroll: true })
        else fallback?.focus({ preventScroll: true })
      }
    }

    previousDetailRef.current = detailOpen
  }, [detailOpen, displayed, exiting, listScroll, sourceId])

  return {
    hostRef,
    libraryRef,
    scrollRef,
    detailRef,
    backRef,
    displayed,
    exiting,
    reduced,
    finishExit: () => {
      if (exiting) setDisplayedDetail(detailOpen)
    },
  }
}
