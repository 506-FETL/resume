export interface HighlightSourceRect {
  key: string
  threadId: string
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
}

export interface HighlightVisualRect {
  key: string
  threadIds: string[]
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
}

type RectBounds = Pick<HighlightSourceRect, 'x' | 'y' | 'width' | 'height'>

interface VisualLine {
  pageIndex: number
  rects: HighlightSourceRect[]
}

export function rectanglesOverlap(left: RectBounds, right: RectBounds) {
  return left.x < right.x + right.width
    && right.x < left.x + left.width
    && left.y < right.y + right.height
    && right.y < left.y + left.height
}

function verticalOverlapRatio(left: RectBounds, right: RectBounds) {
  const overlap = Math.max(
    0,
    Math.min(left.y + left.height, right.y + right.height)
    - Math.max(left.y, right.y),
  )
  return overlap / Math.max(1, Math.min(left.height, right.height))
}

function areLineCompatible(left: HighlightSourceRect, right: HighlightSourceRect) {
  const heightSimilarity = Math.min(left.height, right.height)
    / Math.max(1, Math.max(left.height, right.height))
  return left.pageIndex === right.pageIndex
    && heightSimilarity >= 0.6
    && verticalOverlapRatio(left, right) >= 0.6
}

function isSameVisualLine(line: VisualLine, rect: HighlightSourceRect) {
  return line.pageIndex === rect.pageIndex
    && line.rects.some(candidate => areLineCompatible(candidate, rect))
}

function geometryKey(rect: Omit<HighlightVisualRect, 'key' | 'threadIds'>) {
  const normalize = (value: number) => Math.round(value * 100) / 100
  return [
    'visual',
    rect.pageIndex,
    normalize(rect.x),
    normalize(rect.y),
    normalize(rect.width),
    normalize(rect.height),
  ].join(':')
}

function mergeLineIntervals(line: VisualLine): HighlightVisualRect[] {
  const ordered = [...line.rects].sort((left, right) => left.x - right.x)
  const merged: HighlightVisualRect[] = []

  for (const rect of ordered) {
    const previous = merged.at(-1)
    const rectRight = rect.x + rect.width
    if (previous && rect.x < previous.x + previous.width) {
      const x = Math.min(previous.x, rect.x)
      const y = Math.min(previous.y, rect.y)
      const right = Math.max(previous.x + previous.width, rectRight)
      const bottom = Math.max(previous.y + previous.height, rect.y + rect.height)
      previous.x = x
      previous.y = y
      previous.width = right - x
      previous.height = bottom - y
      previous.threadIds = Array.from(new Set([...previous.threadIds, rect.threadId]))
      previous.key = geometryKey(previous)
      continue
    }

    const visual = {
      threadIds: [rect.threadId],
      pageIndex: rect.pageIndex,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    }
    merged.push({
      ...visual,
      key: geometryKey(visual),
    })
  }

  return merged
}

export function mergeHighlightVisualRects(
  rects: readonly HighlightSourceRect[],
): HighlightVisualRect[] {
  const ordered = [...rects].sort((left, right) => (
    left.pageIndex - right.pageIndex
    || left.y - right.y
    || left.x - right.x
  ))
  const lines: VisualLine[] = []

  for (const rect of ordered) {
    const matchingLines = lines.filter(candidate => isSameVisualLine(candidate, rect))
    const line = matchingLines[0]
    if (line) {
      line.rects.push(
        ...matchingLines.slice(1).flatMap(candidate => candidate.rects),
        rect,
      )
      for (const mergedLine of matchingLines.slice(1))
        lines.splice(lines.indexOf(mergedLine), 1)
      continue
    }
    lines.push({
      pageIndex: rect.pageIndex,
      rects: [rect],
    })
  }

  return lines.flatMap(mergeLineIntervals)
}
