export type DragAxis = 'x' | 'y'

export interface DragPoint {
  x: number
  y: number
}

export interface DragRect {
  id: string
  top: number
  right: number
  bottom: number
  left: number
}

export interface DropDestination {
  containerId: string
  index: number
}

export function moveArrayItem<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length)
    return items

  const next = [...items]
  const [moved] = next.splice(from, 1)
  const destination = Math.max(0, Math.min(to, next.length))
  next.splice(destination, 0, moved)
  return next
}

export function findDropContainer(point: DragPoint, containers: DragRect[]): string | null {
  const matches = containers.filter(rect => (
    point.x >= rect.left
    && point.x <= rect.right
    && point.y >= rect.top
    && point.y <= rect.bottom
  ))

  if (matches.length === 0)
    return null

  matches.sort((a, b) => (
    (a.right - a.left) * (a.bottom - a.top)
    - (b.right - b.left) * (b.bottom - b.top)
  ))
  return matches[0].id
}

export function findDropIndex(point: DragPoint, items: DragRect[], axis: DragAxis): number {
  const coordinate = axis === 'x' ? point.x : point.y
  const sorted = [...items].sort((a, b) => (
    axis === 'x' ? a.left - b.left : a.top - b.top
  ))

  const index = sorted.findIndex((rect) => {
    const center = axis === 'x'
      ? rect.left + (rect.right - rect.left) / 2
      : rect.top + (rect.bottom - rect.top) / 2
    return coordinate < center
  })

  return index === -1 ? sorted.length : index
}

export function getEdgeScrollDelta(
  point: DragPoint,
  rect: Pick<DragRect, 'top' | 'right' | 'bottom' | 'left'>,
  axis: DragAxis,
  threshold = 56,
  maxStep = 18,
): number {
  const coordinate = axis === 'x' ? point.x : point.y
  const start = axis === 'x' ? rect.left : rect.top
  const end = axis === 'x' ? rect.right : rect.bottom
  const effectiveThreshold = Math.min(threshold, Math.max(0, (end - start) / 2))

  if (coordinate < start + effectiveThreshold) {
    const intensity = Math.min(1, Math.max(0, (start + effectiveThreshold - coordinate) / effectiveThreshold))
    return -Math.max(1, Math.round(maxStep * intensity))
  }

  if (coordinate > end - effectiveThreshold) {
    const intensity = Math.min(1, Math.max(0, (coordinate - (end - effectiveThreshold)) / effectiveThreshold))
    return Math.max(1, Math.round(maxStep * intensity))
  }

  return 0
}
