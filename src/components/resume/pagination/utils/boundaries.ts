import type { PageBoundary, PageSegment } from '../types'
import { BOUNDARY_EPSILON } from '../const'
import { hash } from './metrics'
import { isVisible } from './metrics'
import { roundMetric } from './metrics'

export function collectPageBoundaries(root: HTMLElement) {
  const nodePaths = new WeakMap<Node, string>()

  const pendingPaths: Array<{ node: Node; path: string }> = [
    { node: root, path: '' },
  ]

  while (pendingPaths.length) {
    const { node, path } = pendingPaths.pop()!

    nodePaths.set(node, path)

    node.childNodes.forEach((child, index) =>
      pendingPaths.push({
        node: child,
        path: path ? `${path}.${index}` : String(index),
      }),
    )
  }

  const targetDocument = root.ownerDocument
  const targetNodeFilter = targetDocument.defaultView?.NodeFilter
  const rootRect = root.getBoundingClientRect()
  const layoutHeight = Math.max(root.scrollHeight, rootRect.height)
  const candidates: PageBoundary[] = [{ offset: 0, key: 'start' }]
  const atomicRanges: Array<{ top: number; bottom: number }> = []
  const lineRanges: Array<{ top: number; bottom: number }> = []
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

          geometry.push(
            `${roundMetric(top)},${roundMetric(bottom)},${roundMetric(rect.left - rootRect.left)},${roundMetric(rect.width)}`,
          )

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

  root
    .querySelectorAll('[data-pagination-atomic], img, svg, hr')
    .forEach((element) => {
      if (!isVisible(element)) return
      // 背景矢量不决定断点；显式原子和图片始终保留不可拆分范围。
      if (
        element.closest('[data-resume-decoration]') &&
        !element.matches('[data-pagination-atomic], img')
      )
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

  // 章节标题和紧随其后的第一行一起换页，不能把整段正文变为不可拆分块。
  root
    .querySelectorAll('[data-pagination-keep-with-next]')
    .forEach((element) => {
      if (!isVisible(element)) return

      const rect = element.getBoundingClientRect()
      const top = rect.top - rootRect.top
      const bottom = rect.bottom - rootRect.top

      const nextLine = lineRanges
        .filter((line) => line.top >= bottom - BOUNDARY_EPSILON)
        .sort((a, b) => a.top - b.top)[0]

      if (nextLine) atomicRanges.push({ top, bottom: nextLine.bottom })
    })

  const contentHeight = Math.max(layoutHeight, visibleContentBottom)

  candidates.push({ offset: contentHeight, key: 'end' })
  candidates.sort((left, right) => left.offset - right.offset)

  // 合并开放的禁止断点区间，再与有序候选点线性扫描；不能对每一行重扫全文。
  const forbidden = [...atomicRanges, ...lineRanges]
    .map((range) => ({
      top: range.top + BOUNDARY_EPSILON,
      bottom: range.bottom - BOUNDARY_EPSILON,
    }))
    .filter((range) => range.top < range.bottom)
    .sort((left, right) => left.top - right.top)

  const merged: Array<{ top: number; bottom: number }> = []

  for (const range of forbidden) {
    const previous = merged.at(-1)

    if (previous && range.top < previous.bottom)
      previous.bottom = Math.max(previous.bottom, range.bottom)
    else merged.push({ ...range })
  }

  const boundaries: PageBoundary[] = []
  let rangeIndex = 0

  for (const candidate of candidates) {
    while (merged[rangeIndex] && merged[rangeIndex].bottom <= candidate.offset)
      rangeIndex += 1

    const range = merged[rangeIndex]

    if (
      range &&
      candidate.offset > range.top &&
      candidate.offset < range.bottom
    )
      continue

    const previous = boundaries.at(-1)

    if (!previous || candidate.offset - previous.offset > BOUNDARY_EPSILON)
      boundaries.push(candidate)
  }

  return {
    boundaries,
    contentHeight,
    atomicRanges,
    geometry: hash(geometry.join(';')),
  }
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

    while (
      boundaryIndex < boundaries.length &&
      boundaries[boundaryIndex].offset <= limit + BOUNDARY_EPSILON
    ) {
      const boundary = boundaries[boundaryIndex++]

      if (boundary.offset > start + BOUNDARY_EPSILON) endBoundary = boundary
    }

    if (!endBoundary) throw new Error('当前页面内找不到完整文本行断点')

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
    if (
      Math.abs(segments[index].end - segments[index + 1].start) >
      BOUNDARY_EPSILON
    )
      throw new Error('分页区间存在缺口或重叠')
  }

  return segments
}
