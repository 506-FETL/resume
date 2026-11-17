import type { Driver } from 'driver.js/headless'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import useUserStore from '@/store/user'
import { useFeatureGuidesStore } from '@/store/feature-guides'
import type { FeatureGuideOptions, GuideController } from './types'

export function useFeatureGuide(options: FeatureGuideOptions): GuideController {
  const { id, enabled, contextKey } = options
  const sessionId = useId()
  const account = useUserStore((state) => state.currentUser?.id ?? 'guest')
  const authKnown = useUserStore((state) => state.authStatus !== 'unknown')

  const dismissed = useFeatureGuidesStore((state) =>
    state.dismissed[account]?.includes(id),
  )

  const occupied = useFeatureGuidesStore((state) =>
    Boolean(state.active && state.active.session !== sessionId),
  )

  const optionsRef = useRef(options)
  const driverRef = useRef<Driver | null>(null)
  const stopReasonRef = useRef<'dismiss' | 'context'>('context')
  const busyRef = useRef(false)
  const [active, setActive] = useState(false)
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [index, setIndex] = useState(0)
  const [targetIndex, setTargetIndex] = useState(0)
  const [presentedIndex, setPresentedIndex] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [focusStep, setFocusStep] = useState(false)

  optionsRef.current = options

  const ready = useCallback(() => {
    busyRef.current = false
    setBusy(false)
  }, [])

  const close = useCallback(() => {
    stopReasonRef.current = 'dismiss'

    if (isGuideUi(document.activeElement)) {
      findVisibleTarget(optionsRef.current.steps[0].target)?.focus({
        preventScroll: true,
      })
    }

    useFeatureGuidesStore.getState().dismiss(account, id)
    driverRef.current?.destroy()
  }, [account, id])

  const changeStep = useCallback(
    (direction: 1 | -1) => {
      const tour = driverRef.current

      if (!tour || busyRef.current) return

      if (isGuideUi(document.activeElement)) {
        setFocusStep(true)

        document
          .querySelector<HTMLElement>('[data-feature-guide-next]')
          ?.focus({ preventScroll: true })
      }

      const currentIndex = tour.getActiveIndex() ?? 0
      const nextIndex = currentIndex + direction
      const current = optionsRef.current

      if (nextIndex < 0) return
      if (
        direction === 1 &&
        (nextIndex >= current.steps.length ||
          current.steps[currentIndex]?.terminal)
      ) {
        close()

        return
      }

      busyRef.current = true
      setBusy(true)
      setPresentedIndex(null)

      Promise.resolve()
        .then(() => current.prepare?.(nextIndex))
        .then((continueTour) => {
          if (driverRef.current !== tour) return
          if (continueTour === false) {
            close()

            return
          }

          setIndex(nextIndex)
          tour.moveTo(nextIndex)
        })
        .catch(() => {
          if (driverRef.current === tour) close()
        })
    },
    [close],
  )

  const next = useCallback(() => changeStep(1), [changeStep])
  const previous = useCallback(() => changeStep(-1), [changeStep])

  useEffect(() => {
    if (!enabled || !authKnown || dismissed || occupied) return

    let cancelled = false
    let tour: Driver | null = null
    const state = useFeatureGuidesStore.getState()

    if (!state.claim(id, sessionId)) return

    const stop = () => {
      if (driverRef.current !== tour) return

      driverRef.current = null
      setActive(false)
      setPresentedIndex(null)
      ready()
      optionsRef.current.onStop?.(stopReasonRef.current)
      useFeatureGuidesStore.getState().release(sessionId)
    }

    import('driver.js/headless')
      .then(({ driver }) => {
        if (cancelled) return

        tour = driver({
          steps: optionsRef.current.steps.map((step) => ({
            element: () => findVisibleTarget(step.target)!,
          })),
          waitForElement: 6000,
          onHighlighted: (element, _step, { index: currentIndex }) => {
            if (cancelled || !(element instanceof HTMLElement)) return

            setTarget(element)
            setIndex(currentIndex ?? 0)
            setTargetIndex(currentIndex ?? 0)
            setActive(true)

            if (!optionsRef.current.steps[currentIndex ?? 0]?.animated) ready()
          },
          onElementReplaced: (element) => {
            if (element instanceof HTMLElement) setTarget(element)
          },
          onElementMissing: () => tour?.destroy(),
          onDestroyed: stop,
        })

        driverRef.current = tour
        stopReasonRef.current = 'context'
        setIndex(0)
        setPresentedIndex(null)
        setFocusStep(false)
        ready()
        tour.drive()
      })
      .catch(() => useFeatureGuidesStore.getState().release(sessionId))

    return () => {
      cancelled = true
      tour?.destroy()
      useFeatureGuidesStore.getState().release(sessionId)
    }
  }, [
    account,
    authKnown,
    contextKey,
    dismissed,
    enabled,
    id,
    occupied,
    ready,
    sessionId,
  ])

  return {
    active,
    target,
    index,
    targetIndex,
    presentedIndex,
    busy,
    focusStep,
    step: options.steps[targetIndex] ?? options.steps[0],
    count: options.steps.length,
    next,
    previous,
    presented: setPresentedIndex,
    close,
    ready,
  }
}

function isGuideUi(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(target.closest('[data-feature-guide-ui]'))
  )
}

function findVisibleTarget(selector: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
    (element) => {
      const rect = element.getBoundingClientRect()

      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight &&
        rect.right > 0 &&
        rect.left < window.innerWidth &&
        !element.closest('[inert], [hidden], [aria-hidden="true"]')
      )
    },
  )
}
