export interface BubbleRect {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export type BubbleDisplayMode = 'full' | 'compact' | 'hidden'

export function clipRect(
  rect: BubbleRect,
  boundary: BubbleRect,
): BubbleRect | null {
  if (rect.width <= 0 || rect.height <= 0)
    return null

  const left = Math.max(rect.left, boundary.left)
  const top = Math.max(rect.top, boundary.top)
  const right = Math.min(rect.right, boundary.right)
  const bottom = Math.min(rect.bottom, boundary.bottom)

  if (right <= left || bottom <= top)
    return null

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  }
}

export function getVisibleSelectionRects(
  rects: BubbleRect[],
  boundary: BubbleRect,
) {
  return rects
    .map(rect => clipRect(rect, boundary))
    .filter((rect): rect is BubbleRect => rect !== null)
}

export function combineRects(rects: BubbleRect[]): BubbleRect | null {
  if (rects.length === 0)
    return null

  const left = Math.min(...rects.map(rect => rect.left))
  const top = Math.min(...rects.map(rect => rect.top))
  const right = Math.max(...rects.map(rect => rect.right))
  const bottom = Math.max(...rects.map(rect => rect.bottom))

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  }
}

export function getBubbleDisplayMode({
  availableWidth,
  fullWidth,
  compactWidth,
}: {
  availableWidth: number
  fullWidth: number
  compactWidth: number
}): BubbleDisplayMode {
  if (availableWidth < compactWidth)
    return 'hidden'
  return fullWidth <= availableWidth ? 'full' : 'compact'
}
