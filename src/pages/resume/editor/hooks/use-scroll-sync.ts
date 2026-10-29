import type { RefObject } from 'react'
import type { UIAction } from '@/lib/collaboration'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useCallback, useEffect, useRef } from 'react'
import { useThrottledCallback } from '@/hooks/use-throttled-callback'

export type ScrollTarget = 'window' | 'preview'

interface UseScrollSyncOptions {
  scrollContainerRef: RefObject<HTMLDivElement | null>
  isApplyingRemote: RefObject<boolean>
  followMode: boolean
  broadcastUIAction: (action: UIAction) => void
}

interface UseScrollSyncResult {
  isAnimatingRemoteScroll: RefObject<boolean>
  suppressScrollSync: (durationMs?: number) => void
  animateRemoteScrollTo: (target: ScrollTarget, position: number) => void
  cancelRemoteScrollAnimation: () => void
  getScrollPosition: () => number
}

export function useScrollSync({
  scrollContainerRef,
  isApplyingRemote,
  followMode,
  broadcastUIAction,
}: UseScrollSyncOptions): UseScrollSyncResult {
  const reduced = useReducedMotion()
  const isAnimatingRemoteScroll = useRef(false)
  const suppressScrollSyncUntilRef = useRef(0)
  const remoteScrollAnimationFrameRef = useRef<number | null>(null)

  const remoteScrollTargetRef = useRef<{
    target: ScrollTarget
    position: number
  } | null>(null)

  const suppressScrollSync = useCallback((durationMs = 180) => {
    suppressScrollSyncUntilRef.current = Date.now() + durationMs
  }, [])

  const shouldIgnoreScrollSync = useCallback(() => {
    return Date.now() < suppressScrollSyncUntilRef.current
  }, [])

  const getScrollPosition = useCallback(() => {
    const previewScrollTop = scrollContainerRef.current?.scrollTop ?? 0

    const windowScrollTop =
      window.scrollY ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0

    return previewScrollTop > 0 ? previewScrollTop : windowScrollTop
  }, [scrollContainerRef])

  const getScrollTarget = useCallback((): ScrollTarget => {
    const previewElement = scrollContainerRef.current

    if (
      previewElement &&
      previewElement.scrollHeight > previewElement.clientHeight
    )
      return 'preview'

    return 'window'
  }, [scrollContainerRef])

  const getScrollPositionByTarget = useCallback(
    (target: ScrollTarget) => {
      if (target === 'preview')
        return scrollContainerRef.current?.scrollTop ?? 0

      return (
        window.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0
      )
    },
    [scrollContainerRef],
  )

  const setScrollPositionByTarget = useCallback(
    (target: ScrollTarget, position: number) => {
      if (target === 'preview') {
        const previewElement = scrollContainerRef.current

        if (previewElement) previewElement.scrollTop = position

        return
      }

      window.scrollTo({ top: position, left: window.scrollX, behavior: 'auto' })
    },
    [scrollContainerRef],
  )

  const clampScrollPosition = useCallback(
    (target: ScrollTarget, position: number) => {
      const element =
        target === 'preview'
          ? scrollContainerRef.current
          : document.scrollingElement

      const maximum = element
        ? Math.max(0, element.scrollHeight - element.clientHeight)
        : 0

      return Math.min(maximum, Math.max(0, position))
    },
    [scrollContainerRef],
  )

  const cancelRemoteScrollAnimation = useCallback(() => {
    if (remoteScrollAnimationFrameRef.current !== null) {
      cancelAnimationFrame(remoteScrollAnimationFrameRef.current)
      remoteScrollAnimationFrameRef.current = null
    }

    remoteScrollTargetRef.current = null
    isAnimatingRemoteScroll.current = false
  }, [])

  const stepRemoteScroll = useCallback(() => {
    const nextTarget = remoteScrollTargetRef.current

    if (!nextTarget) {
      cancelRemoteScrollAnimation()

      return
    }

    const currentPosition = getScrollPositionByTarget(nextTarget.target)
    const position = clampScrollPosition(nextTarget.target, nextTarget.position)
    const delta = position - currentPosition

    if (Math.abs(delta) <= 1) {
      setScrollPositionByTarget(nextTarget.target, position)
      cancelRemoteScrollAnimation()

      return
    }

    const step =
      Math.sign(delta) * Math.min(Math.max(Math.abs(delta) * 0.24, 6), 120)

    const nextPosition =
      Math.abs(step) >= Math.abs(delta) ? position : currentPosition + step

    setScrollPositionByTarget(nextTarget.target, nextPosition)

    if (
      Math.abs(getScrollPositionByTarget(nextTarget.target) - currentPosition) <
      0.5
    ) {
      cancelRemoteScrollAnimation()

      return
    }

    remoteScrollAnimationFrameRef.current =
      requestAnimationFrame(stepRemoteScroll)
  }, [
    cancelRemoteScrollAnimation,
    clampScrollPosition,
    getScrollPositionByTarget,
    setScrollPositionByTarget,
  ])

  const animateRemoteScrollTo = useCallback(
    (target: ScrollTarget, position: number) => {
      if (reduced) {
        cancelRemoteScrollAnimation()
        suppressScrollSync()
        setScrollPositionByTarget(target, clampScrollPosition(target, position))

        return
      }

      remoteScrollTargetRef.current = { target, position }
      isAnimatingRemoteScroll.current = true

      if (remoteScrollAnimationFrameRef.current !== null) return

      remoteScrollAnimationFrameRef.current =
        requestAnimationFrame(stepRemoteScroll)
    },
    [
      reduced,
      cancelRemoteScrollAnimation,
      suppressScrollSync,
      setScrollPositionByTarget,
      clampScrollPosition,
      stepRemoteScroll,
    ],
  )

  useEffect(() => {
    const target = remoteScrollTargetRef.current

    if (!reduced || !target) return

    animateRemoteScrollTo(target.target, target.position)
  }, [reduced, animateRemoteScrollTo])

  const broadcastScroll = useThrottledCallback(
    (target: ScrollTarget) => {
      if (
        isApplyingRemote.current ||
        isAnimatingRemoteScroll.current ||
        shouldIgnoreScrollSync()
      )
        return

      broadcastUIAction({
        kind: 'scroll',
        position: getScrollPositionByTarget(target),
        target,
      })
    },
    80,
    [
      broadcastUIAction,
      getScrollPositionByTarget,
      shouldIgnoreScrollSync,
      isApplyingRemote,
    ],
  )

  useEffect(() => {
    const previewElement = scrollContainerRef.current

    const handleWindowScroll = () => {
      if (getScrollTarget() === 'window') broadcastScroll('window')
    }

    const handlePreviewScroll = () => {
      broadcastScroll('preview')
    }

    window.addEventListener('scroll', handleWindowScroll, { passive: true })

    previewElement?.addEventListener('scroll', handlePreviewScroll, {
      passive: true,
    })

    return () => {
      window.removeEventListener('scroll', handleWindowScroll)
      previewElement?.removeEventListener('scroll', handlePreviewScroll)
      broadcastScroll.cancel()
    }
  }, [scrollContainerRef, getScrollTarget, broadcastScroll])

  useEffect(() => {
    if (followMode) return

    cancelRemoteScrollAnimation()
  }, [followMode, cancelRemoteScrollAnimation])

  useEffect(() => {
    return () => {
      cancelRemoteScrollAnimation()
    }
  }, [cancelRemoteScrollAnimation])

  return {
    isAnimatingRemoteScroll,
    suppressScrollSync,
    animateRemoteScrollTo,
    cancelRemoteScrollAnimation,
    getScrollPosition,
  }
}
