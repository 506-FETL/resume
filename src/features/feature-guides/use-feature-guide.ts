import type { Driver } from 'driver.js/headless'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
} from 'react'
import useUserStore from '@/store/user'
import { useFeatureGuidesStore } from '@/store/feature-guides'
import { findGuideTarget, useGuideAnchor } from './use-guide-anchor'
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
  const [highlighted, setHighlighted] = useState<HTMLElement | null>(null)
  const [index, setIndex] = useState(0)
  const [targetIndex, setTargetIndex] = useState(0)
  const [presentedIndex, setPresentedIndex] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [focusStep, setFocusStep] = useState(false)

  const step = options.steps[targetIndex] ?? options.steps[0]
  const eligible = enabled && authKnown && !occupied && !dismissed
  const anchor = useGuideAnchor(step.target, eligible, id, targetIndex)

  const target =
    anchor.target ??
    (anchor.pending &&
    highlighted?.isConnected &&
    highlighted.matches(step.target)
      ? highlighted
      : null)

  const canStart = eligible && (active || Boolean(anchor.target))
  const entryRef = useRef<HTMLElement | null>(null)

  if (targetIndex === 0 && anchor.target) entryRef.current = anchor.target

  const interrupt = useCallback(() => driverRef.current?.destroy(), [])

  optionsRef.current = options

  const ready = useCallback(() => {
    busyRef.current = false
    setBusy(false)
  }, [])

  const close = useCallback(() => {
    stopReasonRef.current = 'dismiss'

    if (isGuideUi(document.activeElement)) {
      const entry = entryRef.current?.isConnected
        ? entryRef.current
        : findGuideTarget(optionsRef.current.steps[0].target)

      entry?.focus({
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
        .then(() => {
          if (driverRef.current !== tour) return

          useFeatureGuidesStore.getState().setStep(sessionId, nextIndex)

          return current.prepare?.(nextIndex)
        })
        .then((continueTour) => {
          if (driverRef.current !== tour) return
          if (continueTour === false) {
            interrupt()

            return
          }

          setIndex(nextIndex)
          tour.moveTo(nextIndex)
        })
        .catch(() => {
          if (driverRef.current === tour) interrupt()
        })
    },
    [close, interrupt, sessionId],
  )

  const next = useCallback(() => changeStep(1), [changeStep])
  const previous = useCallback(() => changeStep(-1), [changeStep])

  useEffect(() => {
    if (!canStart) return

    let cancelled = false
    let tour: Driver | null = null
    const state = useFeatureGuidesStore.getState()

    if (!state.claim(id, sessionId)) return

    const stop = () => {
      if (driverRef.current !== tour) return

      driverRef.current = null
      setHighlighted(null)
      setActive(false)
      setIndex(0)
      setTargetIndex(0)
      setPresentedIndex(null)
      ready()
      optionsRef.current.onStop?.(stopReasonRef.current)
      useFeatureGuidesStore.getState().release(sessionId)
    }

    import('driver.js/headless')
      .then(({ driver }) => {
        if (cancelled) return

        tour = driver({
          scrollIntoView: false,
          steps: optionsRef.current.steps.map((step, i) => ({
            element: () =>
              i === 0 && entryRef.current?.isConnected
                ? entryRef.current
                : findGuideTarget(step.target)!,
          })),
          waitForElement: 6000,
          onHighlighted: (element, _step, { index: currentIndex }) => {
            if (cancelled || !(element instanceof HTMLElement)) return

            setHighlighted(element)
            setIndex(currentIndex ?? 0)
            setTargetIndex(currentIndex ?? 0)
            setActive(true)

            if (!optionsRef.current.steps[currentIndex ?? 0]?.animated) ready()
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
  }, [account, canStart, contextKey, id, ready, sessionId])

  const suspended =
    !enabled ||
    occupied ||
    anchor.blocked ||
    (active && !dismissed && !target && index === targetIndex)

  useLayoutEffect(() => {
    if (!suspended) return

    setPresentedIndex(null)
    setFocusStep(false)
  }, [suspended])

  return {
    active: active && !dismissed,
    target,
    blocked: anchor.blocked,
    suspended,
    interrupt,
    index,
    targetIndex,
    presentedIndex,
    busy,
    focusStep,
    step,
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
