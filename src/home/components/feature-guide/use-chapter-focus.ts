import { useCallback, useLayoutEffect, useRef } from 'react'

export function useChapterFocus(step: number) {
  const pendingRef = useRef<HTMLElement | null>(null)

  const focusWhenVisible = useCallback(() => {
    const heading = pendingRef.current

    if (!heading || heading.closest('[inert]')) return

    pendingRef.current = null
    heading.focus({ preventScroll: true })
  }, [])

  const requestChapterFocus = useCallback(
    (id: string) => {
      pendingRef.current = document.getElementById(`story-heading-${id}`)
      requestAnimationFrame(focusWhenVisible)
    },
    [focusWhenVisible],
  )

  useLayoutEffect(() => {
    const onHash = () => requestChapterFocus(window.location.hash.slice(1))

    const cancel = () => {
      pendingRef.current = null
    }

    onHash()
    window.addEventListener('hashchange', onHash)
    window.addEventListener('wheel', cancel, { passive: true })
    window.addEventListener('touchstart', cancel, { passive: true })

    return () => {
      pendingRef.current = null
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('wheel', cancel)
      window.removeEventListener('touchstart', cancel)
    }
  }, [requestChapterFocus])

  useLayoutEffect(() => {
    if (
      !pendingRef.current &&
      document.activeElement?.closest('.story-caption[inert]')
    ) {
      pendingRef.current = document.querySelector(
        '.story-caption[data-active="true"] h2',
      )
    }

    focusWhenVisible()
  }, [step, focusWhenVisible])
}
