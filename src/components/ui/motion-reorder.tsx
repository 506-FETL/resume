import type { Dispatch, SetStateAction } from 'react'
import type { DragAxis, DragPoint } from '@/lib/motion-drag'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getEdgeScrollDelta, moveArrayItem } from '@/lib/motion-drag'

export const MOTION_REORDER_TRANSITION = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 40,
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
}: {
  values: T[]
  axis: DragAxis
  onCommit: (values: T[]) => void
}): {
    draft: T[]
    setDraft: Dispatch<SetStateAction<T[]>>
    dragging: boolean
    startDragging: () => void
    finishDragging: () => void
    moveByKeyboard: (value: T, direction: -1 | 1) => void
  } {
  const [draft, setDraft] = useState(values)
  const [dragging, setDragging] = useState(false)
  const startSnapshotRef = useRef(values)
  const draftRef = useRef(draft)
  const onCommitRef = useRef(onCommit)

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  useEffect(() => {
    onCommitRef.current = onCommit
  }, [onCommit])

  useEffect(() => {
    if (!dragging) {
      setDraft(values)
      draftRef.current = values
    }
  }, [dragging, values])

  const startDragging = useCallback(() => {
    startSnapshotRef.current = draftRef.current
    setDragging(true)
  }, [])

  const finishDragging = useCallback(() => {
    const next = draftRef.current
    setDragging(false)
    if (!arraysEqual(startSnapshotRef.current, next))
      onCommitRef.current(next)
  }, [])

  const moveByKeyboard = useCallback((value: T, direction: -1 | 1) => {
    const current = draftRef.current
    const sourceIndex = current.findIndex(item => Object.is(item, value))
    const destinationIndex = sourceIndex + direction
    if (sourceIndex < 0 || destinationIndex < 0 || destinationIndex >= current.length)
      return

    const next = moveArrayItem(current, sourceIndex, destinationIndex)
    draftRef.current = next
    startSnapshotRef.current = next
    setDraft(next)
    onCommitRef.current(next)
  }, [])

  return {
    draft,
    setDraft,
    dragging,
    startDragging,
    finishDragging,
    moveByKeyboard,
  }
}
