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
  const nodePaths = new WeakMap<Node, string>()
  const pendingPaths: Array<{ node: Node, path: string }> = [{ node: root, path: '' }]
  while (pendingPaths.length) {
    const { node, path } = pendingPaths.pop()!
    nodePaths.set(node, path)
    node.childNodes.forEach((child, index) => pendingPaths.push({ node: child, path: path ? `${path}.${index}` : String(index) }))
  }
  const targetDocument = root.ownerDocument
  const targetNodeFilter = targetDocument.defaultView?.NodeFilter
  const rootRect = root.getBoundingClientRect()
  const layoutHeight = Math.max(root.scrollHeight, rootRect.height)
  const candidates: PageBoundary[] = [{ offset: 0, key: 'start' }]
  const atomicRanges: Array<{ top: number, bottom: number }> = []
  const lineRanges: Array<{ top: number, bottom: number }> = []
  const geometry: string[] = []
  let visibleContentBottom = 0
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
        const top = rect.top - rootRect.top
        const bottom = rect.bottom - rootRect.top
        if (rect.width > 0 && rect.height > 0) {
          lineRanges.push({ top, bottom })
          geometry.push(`${roundMetric(top)},${roundMetric(bottom)},${roundMetric(rect.left - rootRect.left)},${roundMetric(rect.width)}`)
          visibleContentBottom = Math.max(visibleContentBottom, bottom)

          if (top > BOUNDARY_EPSILON) {
            candidates.push({
              offset: top,
              key: hash(`${nodePaths.get(current!)}:${text}:${lineIndex}`),
            })
          }

          candidates.push({
            offset: bottom,
            key: hash(`${nodePaths.get(current!)}:${text}:${lineIndex}:end`),
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
    // 背景矢量不决定断点；显式原子和图片始终保留不可拆分范围。
    if (element.closest('[data-resume-decoration]') && !element.matches('[data-pagination-atomic], img'))
      return
    const rect = element.getBoundingClientRect()
    const top = rect.top - rootRect.top
    const bottom = rect.bottom - rootRect.top
    if (rect.width > 0 && rect.height > 0) {
      atomicRanges.push({ top, bottom })
      visibleContentBottom = Math.max(visibleContentBottom, bottom)

      if (top > BOUNDARY_EPSILON) {
        candidates.push({
          offset: top,
          key: hash(`${nodePaths.get(element)}:atomic-start`),
        })
      }

      candidates.push({
        offset: bottom,
        key: hash(`${nodePaths.get(element)}:atomic-end`),
      })
    }
  })

  const contentHeight = Math.max(layoutHeight, visibleContentBottom)
  candidates.push({ offset: contentHeight, key: 'end' })
  candidates.sort((left, right) => left.offset - right.offset)

  // 合并开放的禁止断点区间，再与有序候选点线性扫描；不能对每一行重扫全文。
  const forbidden = [...atomicRanges, ...lineRanges]
    .map(range => ({ top: range.top + BOUNDARY_EPSILON, bottom: range.bottom - BOUNDARY_EPSILON }))
    .filter(range => range.top < range.bottom)
    .sort((left, right) => left.top - right.top)
  const merged: Array<{ top: number, bottom: number }> = []
  for (const range of forbidden) {
    const previous = merged.at(-1)
    if (previous && range.top < previous.bottom)
      previous.bottom = Math.max(previous.bottom, range.bottom)
    else
      merged.push({ ...range })
  }
  const boundaries: PageBoundary[] = []
  let rangeIndex = 0
  for (const candidate of candidates) {
    while (merged[rangeIndex] && merged[rangeIndex].bottom <= candidate.offset)
      rangeIndex += 1
    const range = merged[rangeIndex]
    if (range && candidate.offset > range.top && candidate.offset < range.bottom)
      continue
    const previous = boundaries.at(-1)
    if (!previous || candidate.offset - previous.offset > BOUNDARY_EPSILON)
      boundaries.push(candidate)
  }

  return { boundaries, contentHeight, atomicRanges, geometry: hash(geometry.join(';')) }
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
  let boundaryIndex = 0

  while (contentHeight - start > viewportHeight + BOUNDARY_EPSILON) {
    const limit = start + viewportHeight
    let endBoundary: PageBoundary | undefined
    while (boundaryIndex < boundaries.length && boundaries[boundaryIndex].offset <= limit + BOUNDARY_EPSILON) {
      const boundary = boundaries[boundaryIndex++]
      if (boundary.offset > start + BOUNDARY_EPSILON)
        endBoundary = boundary
    }

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
  viewport,
  segments,
  fontFamily,
  geometry,
}: {
  page: HTMLElement
  source: HTMLElement
  viewport: HTMLElement
  geometry: string
  segments: PageSegment[]
  fontFamily: string
}): ResumeLayoutSignature {
  const pageRect = page.getBoundingClientRect()
  const contentHeight = segments.at(-1)?.end
    ?? Math.max(source.scrollHeight, source.getBoundingClientRect().height)
  return {
    pageWidth: roundMetric(pageRect.width),
    pageHeight: roundMetric(pageRect.height),
    contentHeight: roundMetric(contentHeight),
    viewportWidth: roundMetric(viewport.getBoundingClientRect().width),
    viewportHeight: roundMetric(viewport.getBoundingClientRect().height),
    geometry,
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
  const { boundaries, contentHeight, atomicRanges, geometry } = collectPageBoundaries(source)
  const viewportHeight = viewport.getBoundingClientRect().height
  if (atomicRanges.some(range => range.bottom - range.top > viewportHeight + BOUNDARY_EPSILON))
    throw new Error('存在高于一页的不可拆分内容，请缩短该内容或调整字号与边距')
  const segments = buildPageSegments(boundaries, contentHeight, viewportHeight)
  return {
    segments,
    signature: createLayoutSignature({
      page,
      source,
      viewport,
      geometry,
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

  const loadedFaces = await Promise.all(
    weights.map(weight =>
      targetDocument.fonts.load(`${weight} 16px "${familyName}"`)),
  )
  if (loadedFaces.some(faces => faces.length === 0))
    throw new Error(`字体 ${familyName} 未注册`)

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

/** 图片解码完成前不发布稳定布局，打印副本执行相同门禁。 */
export async function waitForResumeImages(root: HTMLElement | Document) {
  await Promise.all(Array.from(root.querySelectorAll('img')).map(async (image) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        image.decode(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('简历图片加载超时')), 10000) }),
      ])
      if (!image.naturalWidth || !image.naturalHeight)
        throw new Error('简历图片加载失败')
    }
    finally { clearTimeout(timer) }
  }))
}
