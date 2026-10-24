import type { RefObject } from 'react'
import type { PendingCommentSelection } from '../store/types.ts'
import { useCallback, useEffect, useRef } from 'react'
import { rangeToVisiblePageRects } from '../anchors/geometry.ts'
import { resolveCommentSelection } from '../anchors/selection.ts'
import { useResumeCommentContext } from '../context.tsx'

interface UseCommentSelectionOptions {
  rootRef: RefObject<HTMLElement | null>
  documentHash: string
  enabled: boolean
  onInvalidSelection?: () => void
}

function getEventTargetElement(target: EventTarget | null) {
  if (target instanceof Element) return target
  if (target instanceof Node) return target.parentElement
  return null
}

function toPendingSelection(
  resolved: NonNullable<ReturnType<typeof resolveCommentSelection>>,
): PendingCommentSelection | null {
  const pageRects = rangeToVisiblePageRects(resolved.range)
  if (pageRects.length === 0) return null
  return {
    anchor: resolved.anchor,
    exactQuote: resolved.anchor.exactQuote,
    originalPageIndex: pageRects[0]?.pageIndex ?? null,
    clientRects: Array.from(resolved.range.getClientRects()).map((rect) => ({
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    })),
  }
}

export function useCommentSelection({
  rootRef,
  documentHash,
  enabled,
  onInvalidSelection,
}: UseCommentSelectionOptions) {
  const { store } = useResumeCommentContext()
  const pointerSelecting = useRef(false)
  const keyboardSelecting = useRef(false)
  const completionArmed = useRef(false)
  const interactionGeneration = useRef(0)
  const evaluationFrame = useRef(0)
  const stabilizationFrame = useRef(0)
  const evaluationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hidePendingSelection = useCallback(() => {
    store.getState().setSelection(null)
  }, [store])

  const clearSelection = useCallback(() => {
    completionArmed.current = false
    interactionGeneration.current += 1
    hidePendingSelection()
    window.getSelection()?.removeAllRanges()
  }, [hidePendingSelection])

  const evaluate = useCallback(() => {
    if (
      !enabled ||
      !documentHash ||
      pointerSelecting.current ||
      keyboardSelecting.current
    ) {
      return
    }
    const root = rootRef.current
    const selection = window.getSelection()
    if (!root || !selection || selection.rangeCount !== 1) {
      hidePendingSelection()
      return
    }
    const range = selection.getRangeAt(0)
    if (range.collapsed) {
      hidePendingSelection()
      return
    }
    const resolved = resolveCommentSelection(range, { documentHash })
    const pending =
      resolved && root.contains(resolved.nodeElement)
        ? toPendingSelection(resolved)
        : null
    if (!pending) {
      hidePendingSelection()
      onInvalidSelection?.()
      return
    }
    store.getState().setSelection(pending)
  }, [
    documentHash,
    enabled,
    hidePendingSelection,
    onInvalidSelection,
    rootRef,
    store,
  ])

  useEffect(() => {
    if (!enabled) return
    const root = rootRef.current
    if (!root) return

    const cancelScheduledEvaluation = () => {
      if (evaluationTimer.current !== null) {
        clearTimeout(evaluationTimer.current)
        evaluationTimer.current = null
      }
      cancelAnimationFrame(evaluationFrame.current)
      cancelAnimationFrame(stabilizationFrame.current)
    }
    const scheduleEvaluation = (delay = 0) => {
      cancelScheduledEvaluation()
      const generation = interactionGeneration.current
      evaluationTimer.current = setTimeout(() => {
        evaluationTimer.current = null
        evaluationFrame.current = requestAnimationFrame(() => {
          stabilizationFrame.current = requestAnimationFrame(() => {
            if (
              generation !== interactionGeneration.current ||
              pointerSelecting.current ||
              keyboardSelecting.current
            ) {
              return
            }
            evaluate()
          })
        })
      }, delay)
    }
    const beginSelectionInteraction = (kind: 'pointer' | 'keyboard') => {
      interactionGeneration.current += 1
      if (kind === 'pointer') pointerSelecting.current = true
      else keyboardSelecting.current = true
      completionArmed.current = false
      cancelScheduledEvaluation()
      hidePendingSelection()
    }
    const finishSelectionInteraction = (kind: 'pointer' | 'keyboard') => {
      const wasSelecting =
        kind === 'pointer'
          ? pointerSelecting.current
          : keyboardSelecting.current
      if (!wasSelecting) {
        return
      }
      if (kind === 'pointer') pointerSelecting.current = false
      else keyboardSelecting.current = false
      completionArmed.current = true
      interactionGeneration.current += 1
      scheduleEvaluation(120)
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = getEventTargetElement(event.target)
      if (
        !target ||
        !root.contains(target) ||
        target.closest('[data-resume-comment-ui]')
      ) {
        return
      }
      beginSelectionInteraction('pointer')
    }
    const handleSelectStart = (event: Event) => {
      const target = getEventTargetElement(event.target)
      if (
        !target ||
        !root.contains(target) ||
        target.closest('[data-resume-comment-ui]') ||
        pointerSelecting.current ||
        keyboardSelecting.current
      ) {
        return
      }
      // 原生选词可能在 pointerup 之后继续派发 selectstart；不能因此
      // 重新锁定为“正在拖动”，否则再也等不到对应的 pointerup。
      completionArmed.current = true
      hidePendingSelection()
      scheduleEvaluation(120)
    }
    const handlePointerEnd = () => {
      finishSelectionInteraction('pointer')
    }
    const selectionKeys = new Set([
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'PageUp',
      'PageDown',
    ])
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        pointerSelecting.current = false
        keyboardSelecting.current = false
        completionArmed.current = false
        interactionGeneration.current += 1
        cancelScheduledEvaluation()
        hidePendingSelection()
        return
      }
      const selectsAll =
        event.key.toLowerCase() === 'a' && (event.metaKey || event.ctrlKey)
      if (
        ((event.shiftKey && selectionKeys.has(event.key)) || selectsAll) &&
        !keyboardSelecting.current
      ) {
        beginSelectionInteraction('keyboard')
      }
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (
        event.key === 'Shift' ||
        (keyboardSelecting.current && !event.shiftKey)
      )
        finishSelectionInteraction('keyboard')
    }
    const handleSelectionChange = () => {
      if (pointerSelecting.current || keyboardSelecting.current) {
        cancelScheduledEvaluation()
        hidePendingSelection()
        return
      }
      cancelScheduledEvaluation()
      // 同一次已完成选择的后续通知仍需重新读取选区，不能把有效按钮清掉。
      if (completionArmed.current) scheduleEvaluation(120)
      else hidePendingSelection()
    }
    const cancelInteraction = () => {
      pointerSelecting.current = false
      keyboardSelecting.current = false
      completionArmed.current = false
      interactionGeneration.current += 1
      cancelScheduledEvaluation()
      hidePendingSelection()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') cancelInteraction()
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('selectstart', handleSelectStart, true)
    document.addEventListener('pointerup', handlePointerEnd, true)
    document.addEventListener('pointercancel', handlePointerEnd, true)
    root.addEventListener('keydown', handleKeyDown)
    root.addEventListener('keyup', handleKeyUp)
    document.addEventListener('selectionchange', handleSelectionChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', cancelInteraction)
    return () => {
      cancelInteraction()
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('selectstart', handleSelectStart, true)
      document.removeEventListener('pointerup', handlePointerEnd, true)
      document.removeEventListener('pointercancel', handlePointerEnd, true)
      root.removeEventListener('keydown', handleKeyDown)
      root.removeEventListener('keyup', handleKeyUp)
      document.removeEventListener('selectionchange', handleSelectionChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', cancelInteraction)
    }
  }, [enabled, evaluate, hidePendingSelection, rootRef])

  useEffect(() => {
    if (!enabled) hidePendingSelection()
  }, [enabled, hidePendingSelection])

  return { clearSelection, evaluateSelection: evaluate }
}
