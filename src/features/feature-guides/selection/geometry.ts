import type { GuideRect, GuideSelection } from './types'

const EXCLUDED =
  '[data-resume-measurement-source], [data-comment-page-visibility="hidden"], [hidden], [inert], [aria-hidden="true"], [data-feature-guide-ui]'

interface ClipBounds {
  left: number
  top: number
  right: number
  bottom: number
}

export function readGuideRects(selection: GuideSelection): GuideRect[] {
  const clip = visibleClip(selection.element)

  return clip ? rangeRects(selection.range, clip) : []
}

function visibleClip(element: HTMLElement): ClipBounds | null {
  if (
    !element.isConnected ||
    element.ownerDocument !== document ||
    element.closest(EXCLUDED)
  )
    return null

  const viewport = window.visualViewport

  const clip = {
    left: viewport?.offsetLeft ?? 0,
    top: viewport?.offsetTop ?? 0,
    right: (viewport?.offsetLeft ?? 0) + (viewport?.width ?? innerWidth),
    bottom: (viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight),
  }

  for (
    let ancestor: HTMLElement | null = element;
    ancestor;
    ancestor = ancestor.parentElement
  ) {
    const style = getComputedStyle(ancestor)

    if (
      style.display === 'none' ||
      style.visibility !== 'visible' ||
      style.contentVisibility === 'hidden' ||
      Number(style.opacity) === 0
    ) {
      return null
    }

    const bounds = ancestor.getBoundingClientRect()

    if (/(hidden|clip|scroll|auto)/u.test(style.overflowX)) {
      clip.left = Math.max(clip.left, bounds.left)
      clip.right = Math.min(clip.right, bounds.right)
    }
    if (/(hidden|clip|scroll|auto)/u.test(style.overflowY)) {
      clip.top = Math.max(clip.top, bounds.top)
      clip.bottom = Math.min(clip.bottom, bounds.bottom)
    }
  }

  const bounds = element.getBoundingClientRect()

  if (
    clip.right <= clip.left ||
    clip.bottom <= clip.top ||
    bounds.right <= clip.left ||
    bounds.left >= clip.right ||
    bounds.bottom <= clip.top ||
    bounds.top >= clip.bottom
  )
    return null

  return clip
}

function rangeRects(range: Range, clip: ClipBounds): GuideRect[] {
  const rects = textRects(range)

  // 跨页副本保留整段 DOM；只接受完全处于当前页和滚动视口内的文字。
  if (
    rects.length === 0 ||
    rects.some(
      (rect) =>
        rect.left < clip.left - 0.5 ||
        rect.top < clip.top - 0.5 ||
        rect.right > clip.right + 0.5 ||
        rect.bottom > clip.bottom + 0.5,
    )
  ) {
    return []
  }

  const lines: GuideRect[] = []

  for (const rect of rects) {
    const line = lines.find(
      (item) =>
        Math.abs(item.top - rect.top) < 1.5 &&
        Math.abs(item.height - rect.height) < 1.5,
    )

    if (line) {
      const right = Math.max(line.left + line.width, rect.right)

      line.left = Math.min(line.left, rect.left)
      line.width = right - line.left
    } else {
      lines.push({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      })
    }
  }

  return lines.sort(
    (left, right) => left.top - right.top || left.left - right.left,
  )
}

export function pickGuideSelection(root: HTMLElement): GuideSelection | null {
  if (root.ownerDocument !== document || !root.isConnected) return null

  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>('[data-comment-node-key]'),
  ).filter(
    (node) =>
      !node.closest(EXCLUDED) &&
      !/^basics(?:[.:/]|$)/u.test(node.dataset.commentNodeKey ?? ''),
  )

  const paragraphs = nodes.flatMap((node) =>
    Array.from(node.querySelectorAll<HTMLElement>('p, li')).filter(
      (paragraph) => !paragraph.querySelector('p, li'),
    ),
  )

  const candidates = paragraphs.length
    ? paragraphs
    : nodes.filter(
        (node) =>
          !/duration|name|phone|email|degree|position|professional|date|url/iu.test(
            node.dataset.commentNodeKey ?? '',
          ),
      )

  const offset = Math.floor(Math.random() * candidates.length)

  for (let index = 0; index < candidates.length; index += 1) {
    const element = candidates[(index + offset) % candidates.length]
    const selection = pickFromElement(element)

    if (selection) return selection
  }

  return null
}

function pickFromElement(element: HTMLElement): GuideSelection | null {
  const clip = visibleClip(element)

  if (!clip) return null

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  const nodes: { node: Text; start: number; end: number }[] = []
  let text = ''
  let next = walker.nextNode()

  while (next) {
    const node = next as Text

    nodes.push({ node, start: text.length, end: text.length + node.length })
    text += node.data
    next = walker.nextNode()
  }

  const segments = Array.from(
    new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(text),
  )

  if (segments.length < 12) return null

  const randomLength = Math.min(
    segments.length,
    12 + Math.floor(Math.random() * 17),
  )

  for (const length of new Set([randomLength, 12])) {
    const positions = segments.length - length + 1
    const offset = Math.floor(Math.random() * positions)

    for (let attempt = 0; attempt < positions; attempt += 1) {
      const start = (offset + attempt) % positions
      const startOffset = segments[start].index
      const endOffset = segments[start + length]?.index ?? text.length
      const quote = text.slice(startOffset, endOffset)

      if (quote.trim().length < 12) continue

      const first = nodes.find((item) => item.end > startOffset)
      const last = nodes.find((item) => item.end >= endOffset)

      if (!first || !last) continue

      const range = document.createRange()

      range.setStart(first.node, startOffset - first.start)
      range.setEnd(last.node, endOffset - last.start)

      const selection = { text: quote, range, element }

      if (rangeRects(range, clip).length > 0) return selection
    }
  }

  return null
}

function textRects(range: Range): DOMRect[] {
  const ancestor = range.commonAncestorContainer
  const walker = document.createTreeWalker(ancestor, NodeFilter.SHOW_TEXT)
  const rects: DOMRect[] = []
  let node = ancestor.nodeType === Node.TEXT_NODE ? ancestor : walker.nextNode()

  while (node) {
    if (range.intersectsNode(node)) {
      const part = document.createRange()
      const clip = node.parentElement ? visibleClip(node.parentElement) : null

      if (!clip) return []

      part.setStart(node, node === range.startContainer ? range.startOffset : 0)

      part.setEnd(
        node,
        node === range.endContainer
          ? range.endOffset
          : (node.textContent?.length ?? 0),
      )

      const partRects = Array.from(part.getClientRects()).filter(
        (rect) => rect.width > 0.5 && rect.height > 0.5,
      )

      if (part.toString().trim() && partRects.length === 0) return []
      if (
        partRects.some(
          (rect) =>
            rect.left < clip.left - 0.5 ||
            rect.right > clip.right + 0.5 ||
            rect.top < clip.top - 0.5 ||
            rect.bottom > clip.bottom + 0.5,
        )
      )
        return []

      rects.push(...partRects)
    }

    node = walker.nextNode()
  }

  return rects
}
