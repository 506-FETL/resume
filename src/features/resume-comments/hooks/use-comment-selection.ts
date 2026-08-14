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

function rangeBelongsToRoot(range: Range, root: HTMLElement) {
  const common = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer as Element
    : range.commonAncestorContainer.parentElement
  return Boolean(common && root.contains(common))
}

function toPendingSelection(
  resolved: NonNullable<ReturnType<typeof resolveCommentSelection>>,
): PendingCommentSelection | null {
  const pageRects = rangeToVisiblePageRects(resolved.range)
  if (pageRects.length === 0)
    return null
  return {
    anchor: resolved.anchor,
    exactQuote: resolved.anchor.exactQuote,
    originalPageIndex: pageRects[0]?.pageIndex ?? null,
    clientRects: Array.from(resolved.range.getClientRects()).map(rect => ({
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
  const evaluationFrame = useRef(0)

  const clearSelection = useCallback(() => {
    store.getState().setSelection(null)
    window.getSelection()?.removeAllRanges()
  }, [store])

  const evaluate = useCallback(() => {
    if (!enabled || !documentHash)
      return
    const root = rootRef.current
    const selection = window.getSelection()
    if (!root || !selection || selection.rangeCount !== 1)
      return
    const range = selection.getRangeAt(0)
    if (!rangeBelongsToRoot(range, root))
      return
    if (range.collapsed) {
      store.getState().setSelection(null)
      return
    }
    const resolved = resolveCommentSelection(range, { documentHash })
    const pending = resolved ? toPendingSelection(resolved) : null
    if (!pending) {
      store.getState().setSelection(null)
      onInvalidSelection?.()
      return
    }
    store.getState().setSelection(pending)
  }, [documentHash, enabled, onInvalidSelection, rootRef, store])

  useEffect(() => {
    if (!enabled)
      return
    const root = rootRef.current
    if (!root)
      return

    const scheduleEvaluation = () => {
      cancelAnimationFrame(evaluationFrame.current)
      evaluationFrame.current = requestAnimationFrame(evaluate)
    }
    const handlePointerDown = (event: PointerEvent) => {
      if ((event.target as Element | null)?.closest('[data-resume-comment-ui]'))
        return
      pointerSelecting.current = true
      store.getState().setSelection(null)
    }
    const handlePointerEnd = () => {
      pointerSelecting.current = false
      scheduleEvaluation()
    }
    const handleKeyUp = () => scheduleEvaluation()
    const handleSelectionChange = () => {
      if (!pointerSelecting.current)
        scheduleEvaluation()
    }

    root.addEventListener('pointerdown', handlePointerDown)
    root.addEventListener('pointerup', handlePointerEnd)
    root.addEventListener('pointercancel', handlePointerEnd)
    root.addEventListener('keyup', handleKeyUp)
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      cancelAnimationFrame(evaluationFrame.current)
      root.removeEventListener('pointerdown', handlePointerDown)
      root.removeEventListener('pointerup', handlePointerEnd)
      root.removeEventListener('pointercancel', handlePointerEnd)
      root.removeEventListener('keyup', handleKeyUp)
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [enabled, evaluate, rootRef, store])

  return { clearSelection, evaluateSelection: evaluate }
}
