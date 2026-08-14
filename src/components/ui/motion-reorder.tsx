import type { Dispatch, SetStateAction } from 'react'
import type { DragAxis, DragPoint } from '@/lib/motion-drag'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getEdgeScrollDelta, moveArrayItem } from '@/lib/motion-drag'

export const MOTION_REORDER_TRANSITION = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 40,
}

export function findScrollableAncestor(
  element: HTMLElement | null,
  axis: DragAxis,
): HTMLElement | null {
  let current = element?.parentElement ?? null
  while (current) {
    const style = window.getComputedStyle(current)
    const overflow = axis === 'x' ? style.overflowX : style.overflowY
    if (overflow === 'auto' || overflow === 'scroll')
      return current
    current = current.parentElement
  }
  return null
}

function arraysEqual<T>(left: T[], right: T[]): boolean {
  return left.length === right.length && left.every((value, index) => Object.is(value, right[index]))
}

export function autoScrollAtEdge(
  container: HTMLElement | null,
  point: DragPoint,
  axis: DragAxis,
  threshold = 56,
  maxStep = 18,
): boolean {
  if (!container)
    return false

  const delta = getEdgeScrollDelta(point, container.getBoundingClientRect(), axis, threshold, maxStep)
  if (delta === 0)
    return false

  if (axis === 'x')
    container.scrollBy({ left: delta })
  else
    container.scrollBy({ top: delta })
  return true
}

export function useMotionReorder<T>({
  values,
  axis: _axis,
  onCommit,
  commitOnKeyboard = true,
  syncValuesWhileIdle = true,
}: {
  values: T[]
  axis: DragAxis
  onCommit: (values: T[]) => void
  commitOnKeyboard?: boolean
  syncValuesWhileIdle?: boolean
}): {
  draft: T[]
  setDraft: Dispatch<SetStateAction<T[]>>
  dragging: boolean
  startDragging: () => void
  finishDragging: () => void
  cancelDragging: () => void
  moveByKeyboard: (value: T, direction: -1 | 1) => void
} {
  const [draft, setDraftState] = useState(values)
  const [dragging, setDragging] = useState(false)
  const startSnapshotRef = useRef(values)
  const draftRef = useRef(draft)
  const onCommitRef = useRef(onCommit)
  const cancelledRef = useRef(false)

  const setDraft = useCallback<Dispatch<SetStateAction<T[]>>>((nextValue) => {
    setDraftState((current) => {
      if (cancelledRef.current)
        return startSnapshotRef.current
      const next = typeof nextValue === 'function'
        ? nextValue(current)
        : nextValue
      draftRef.current = next
      return next
    })
  }, [])

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  useEffect(() => {
    onCommitRef.current = onCommit
  }, [onCommit])

  useEffect(() => {
    if (syncValuesWhileIdle && !dragging && !arraysEqual(draftRef.current, values)) {
      setDraftState(values)
      draftRef.current = values
    }
  }, [dragging, syncValuesWhileIdle, values])

  const startDragging = useCallback(() => {
    cancelledRef.current = false
    startSnapshotRef.current = draftRef.current
    setDragging(true)
  }, [])

  const finishDragging = useCallback(() => {
    if (cancelledRef.current) {
      setDragging(false)
      return
    }
    const next = draftRef.current
    setDragging(false)
    if (!arraysEqual(startSnapshotRef.current, next))
      onCommitRef.current(next)
  }, [])

  const cancelDragging = useCallback(() => {
    cancelledRef.current = true
    draftRef.current = startSnapshotRef.current
    setDraftState(startSnapshotRef.current)
    setDragging(false)
  }, [])

  useEffect(() => {
    if (!dragging)
      return
    window.addEventListener('pointercancel', cancelDragging, true)
    window.addEventListener('blur', cancelDragging)
    return () => {
      window.removeEventListener('pointercancel', cancelDragging, true)
      window.removeEventListener('blur', cancelDragging)
    }
  }, [cancelDragging, dragging])

  const moveByKeyboard = useCallback((value: T, direction: -1 | 1) => {
    const current = draftRef.current
    const sourceIndex = current.findIndex(item => Object.is(item, value))
    const destinationIndex = sourceIndex + direction
    if (sourceIndex < 0 || destinationIndex < 0 || destinationIndex >= current.length)
      return

    const next = moveArrayItem(current, sourceIndex, destinationIndex)
    draftRef.current = next
    startSnapshotRef.current = next
    setDraftState(next)
    if (commitOnKeyboard)
      onCommitRef.current(next)
  }, [commitOnKeyboard])

  return {
    draft,
    setDraft,
    dragging,
    startDragging,
    finishDragging,
    cancelDragging,
    moveByKeyboard,
  }
}
