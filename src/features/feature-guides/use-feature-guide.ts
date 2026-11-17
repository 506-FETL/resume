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
  const stopReasonRef = useRef<'dismiss' | 'takeover' | 'context'>('context')
  const busyRef = useRef(false)
  const [active, setActive] = useState(false)
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [focusStep, setFocusStep] = useState(false)

  optionsRef.current = options

  const ready = useCallback(() => {
    busyRef.current = false
    setBusy(false)
  }, [])

  const closeWithReason = useCallback(
    (reason: 'dismiss' | 'takeover') => {
      stopReasonRef.current = reason

      if (isGuideUi(document.activeElement)) {
        findVisibleTarget(optionsRef.current.steps[0].target)?.focus({
          preventScroll: true,
        })
      }

      useFeatureGuidesStore.getState().dismiss(account, id)
      driverRef.current?.destroy()
    },
    [account, id],
  )

  const close = useCallback(() => closeWithReason('dismiss'), [closeWithReason])

  const next = useCallback(() => {
    const tour = driverRef.current

    if (!tour || busyRef.current) return

    if (isGuideUi(document.activeElement)) {
      setFocusStep(true)

      document
        .querySelector<HTMLElement>('[data-feature-guide-next]')
        ?.focus({ preventScroll: true })
    }

    const nextIndex = (tour.getActiveIndex() ?? 0) + 1
    const current = optionsRef.current

    if (
      nextIndex >= current.steps.length ||
      current.steps[nextIndex - 1]?.terminal
    ) {
      close()

      return
    }

    busyRef.current = true
    setBusy(true)

    Promise.resolve()
      .then(() => current.prepare?.(nextIndex))
      .then((continueTour) => {
        if (driverRef.current !== tour) return
        if (continueTour === false) {
          close()

          return
        }

        setIndex(nextIndex)
        tour.moveNext()
      })
      .catch(() => {
        if (driverRef.current === tour) close()
      })
  }, [close])

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
            setActive(true)

            if (!optionsRef.current.steps[currentIndex ?? 0]?.animated) ready()
          },
          onElementReplaced: (element) => {
            if (element instanceof HTMLElement) setTarget(element)
          },
          onElementMissing: () => tour?.destroy(),
          onInteraction: (
            _element,
            _step,
            { event, region, index: stepIndex },
          ) => {
            if (isGuideUi(event.target)) return

            if (region === 'element' && stepIndex === 0) {
              if (optionsRef.current.activateTarget === false) {
                closeWithReason('takeover')

                return
              }

              next()

              return false
            }

            closeWithReason('takeover')
          },
          onDestroyed: stop,
        })

        driverRef.current = tour
        stopReasonRef.current = 'context'
        setIndex(0)
        setFocusStep(false)
        ready()
        tour.drive()
      })
      .catch(() => useFeatureGuidesStore.getState().release(sessionId))

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && driverRef.current) close()
    }

    const onInput = (event: Event) => {
      if (!isGuideUi(event.target) && driverRef.current)
        closeWithReason('takeover')
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!tour || isGuideUi(event.target)) return

      const trigger = tour.getActiveElement()

      const starting =
        (tour.getActiveIndex() ?? 0) === 0 &&
        optionsRef.current.activateTarget !== false

      if (
        starting &&
        event.target instanceof Node &&
        trigger?.contains(event.target)
      )
        return

      closeWithReason('takeover')
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('input', onInput)
    window.addEventListener('pointerdown', onPointerDown, true)

    return () => {
      cancelled = true
      tour?.destroy()
      useFeatureGuidesStore.getState().release(sessionId)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('input', onInput)
      window.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [
    account,
    authKnown,
    close,
    closeWithReason,
    contextKey,
    dismissed,
    enabled,
    id,
    next,
    occupied,
    ready,
    sessionId,
  ])

  return {
    active,
    target,
    index,
    busy,
    focusStep,
    step: options.steps[index] ?? options.steps[0],
    count: options.steps.length,
    next,
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
