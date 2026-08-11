import type {
  PageBoundary,
  PageSegment,
  PaginationSnapshot,
  ResumeLayoutSignature,
} from './types'
import { BOUNDARY_EPSILON } from './const'

function hash(value: string) {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return (result >>> 0).toString(36)
}

function getNodePath(node: Node, root: HTMLElement) {
  const indexes: number[] = []
  let current: Node | null = node
  while (current && current !== root) {
    const parentNode: Node | null = current.parentNode
    if (!parentNode)
      break
    indexes.push(Array.prototype.indexOf.call(parentNode.childNodes, current))
    current = parentNode
  }
  return indexes.reverse().join('.')
}

function isVisible(element: Element) {
  const targetWindow = element.ownerDocument.defaultView
  if (!targetWindow)
    return false
  const style = targetWindow.getComputedStyle(element)
  return style.display !== 'none'
    && style.visibility !== 'hidden'
    && style.contentVisibility !== 'hidden'
}

export function collectPageBoundaries(root: HTMLElement) {
  const targetDocument = root.ownerDocument
  const targetNodeFilter = targetDocument.defaultView?.NodeFilter
  const rootRect = root.getBoundingClientRect()
  const contentHeight = Math.max(root.scrollHeight, rootRect.height)
  const candidates: PageBoundary[] = [{ offset: 0, key: 'start' }]
  const walker = targetDocument.createTreeWalker(
    root,
    targetNodeFilter?.SHOW_TEXT ?? 4,
  )

  let current = walker.nextNode()
  while (current) {
    const text = current.textContent ?? ''
    const parent = current.parentElement
    if (text.trim() && parent && isVisible(parent)) {
      const range = targetDocument.createRange()
      range.selectNodeContents(current)
      Array.from(range.getClientRects()).forEach((rect, lineIndex) => {
        const offset = rect.top - rootRect.top
        if (rect.width > 0 && rect.height > 0 && offset > BOUNDARY_EPSILON) {
          candidates.push({
            offset,
            key: hash(`${getNodePath(current!, root)}:${text}:${lineIndex}`),
          })
        }
      })
      range.detach()
    }
    current = walker.nextNode()
  }

  root.querySelectorAll('[data-pagination-atomic], img, svg, hr').forEach((element) => {
    if (!isVisible(element))
      return
    const rect = element.getBoundingClientRect()
    const offset = rect.top - rootRect.top
    if (rect.width > 0 && rect.height > 0 && offset > BOUNDARY_EPSILON) {
      candidates.push({
        offset,
        key: hash(`${getNodePath(element, root)}:atomic`),
      })
    }
  })

  candidates.push({ offset: contentHeight, key: 'end' })
  candidates.sort((left, right) => left.offset - right.offset)

  const boundaries = candidates.filter((candidate, index) => (
    index === 0
    || Math.abs(candidate.offset - candidates[index - 1].offset) > BOUNDARY_EPSILON
  ))

  return { boundaries, contentHeight }
}

export function buildPageSegments(
  boundaries: PageBoundary[],
  contentHeight: number,
  viewportHeight: number,
) {
  if (contentHeight <= 0 || viewportHeight <= 0)
    throw new Error('简历内容尺寸无效')

  const segments: PageSegment[] = []
  let start = 0
  let startKey = 'start'

  while (contentHeight - start > viewportHeight + BOUNDARY_EPSILON) {
    const limit = start + viewportHeight
    const endBoundary = boundaries
      .filter(boundary =>
        boundary.offset > start + BOUNDARY_EPSILON
        && boundary.offset <= limit + BOUNDARY_EPSILON)
      .at(-1)

    if (!endBoundary)
      throw new Error('当前页面内找不到完整文本行断点')

    segments.push({
      start,
      end: endBoundary.offset,
      startKey,
      endKey: endBoundary.key,
    })
    start = endBoundary.offset
    startKey = endBoundary.key
  }

  segments.push({
    start,
    end: contentHeight,
    startKey,
    endKey: 'end',
  })

  for (let index = 0; index < segments.length - 1; index += 1) {
    if (Math.abs(segments[index].end - segments[index + 1].start) > BOUNDARY_EPSILON)
      throw new Error('分页区间存在缺口或重叠')
  }

  return segments
}

function roundMetric(value: number) {
  return Math.round(value * 100) / 100
}

export function createLayoutSignature({
  page,
  source,
  segments,
  fontFamily,
}: {
  page: HTMLElement
  source: HTMLElement
  segments: PageSegment[]
  fontFamily: string
}): ResumeLayoutSignature {
  const pageRect = page.getBoundingClientRect()
  return {
    pageWidth: roundMetric(pageRect.width),
    pageHeight: roundMetric(pageRect.height),
    contentHeight: roundMetric(Math.max(source.scrollHeight, source.getBoundingClientRect().height)),
    fontFamily,
    pages: segments.map(segment => ({
      startKey: segment.startKey,
      endKey: segment.endKey,
    })),
  }
}

export function measurePaginationSnapshot({
  page,
  viewport,
  source,
  fontFamily,
}: {
  page: HTMLElement
  viewport: HTMLElement
  source: HTMLElement
  fontFamily: string
}): PaginationSnapshot {
  const { boundaries, contentHeight } = collectPageBoundaries(source)
  const viewportHeight = viewport.getBoundingClientRect().height
  const segments = buildPageSegments(boundaries, contentHeight, viewportHeight)
  return {
    segments,
    signature: createLayoutSignature({
      page,
      source,
      segments,
      fontFamily,
    }),
  }
}

export function serializeLayoutSignature(signature: ResumeLayoutSignature) {
  return JSON.stringify(signature)
}

export function layoutSignaturesEqual(
  left: ResumeLayoutSignature,
  right: ResumeLayoutSignature,
) {
  return serializeLayoutSignature(left) === serializeLayoutSignature(right)
}

export async function waitForResumeFont(
  targetDocument: Document,
  familyName: string,
  weights: number[],
) {
  if (!targetDocument.fonts)
    throw new Error('当前浏览器不支持字体状态检测')

  await Promise.all(
    weights.map(weight =>
      targetDocument.fonts.load(`${weight} 16px "${familyName}"`)),
  )
  await targetDocument.fonts.ready

  const ready = weights.every(weight =>
    targetDocument.fonts.check(`${weight} 16px "${familyName}"`))
  if (!ready)
    throw new Error(`字体 ${familyName} 加载失败`)
}

export function nextAnimationFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}
