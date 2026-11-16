import type { PaginationSnapshot, ResumeLayoutSignature } from '../types'
import { BOUNDARY_EPSILON } from '../const'
import { hash } from './metrics'
import { collectPageBoundaries } from './boundaries'
import { buildPageSegments } from './boundaries'
import { roundMetric } from './metrics'
import { createLayoutSignature } from './signature'

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
  const regionSources = Array.from(
    source.querySelectorAll<HTMLElement>('[data-resume-region-source]'),
  )

  if (regionSources.length)
    return measureRegionSnapshot({
      page,
      viewport,
      source,
      fontFamily,
      regionSources,
    })

  const { boundaries, contentHeight, atomicRanges, geometry } =
    collectPageBoundaries(source)

  const viewportHeight = viewport.getBoundingClientRect().height

  if (
    atomicRanges.some(
      (range) => range.bottom - range.top > viewportHeight + BOUNDARY_EPSILON,
    )
  )
    throw new Error('存在高于一页的不可拆分内容，请缩短该内容或调整字号与边距')

  const segments = buildPageSegments(boundaries, contentHeight, viewportHeight)

  return {
    segments,
    regions: [{ id: 'main', segments }],
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

export function measureRegionSnapshot({
  page,
  viewport,
  source,
  fontFamily,
  regionSources,
}: {
  page: HTMLElement
  viewport: HTMLElement
  source: HTMLElement
  fontFamily: string
  regionSources: HTMLElement[]
}): PaginationSnapshot {
  const pageRect = page.getBoundingClientRect()
  const ids = new Set<string>()

  const measured = regionSources.map((regionSource) => {
    const id = regionSource.dataset.resumeRegionSource!

    if (!id || ids.has(id)) throw new Error('简历区域标识缺失或重复')

    ids.add(id)

    const regionViewport = regionSource.closest<HTMLElement>(
      '[data-resume-region-viewport]',
    )

    if (!regionViewport) throw new Error('简历区域缺少测量视口')

    const rect = regionViewport.getBoundingClientRect()

    if (rect.width <= 0 || rect.height <= 0)
      throw new Error('简历区域没有可用空间，请减小边距')

    const { boundaries, contentHeight, atomicRanges, geometry } =
      collectPageBoundaries(regionSource)

    if (
      atomicRanges.some(
        (range) => range.bottom - range.top > rect.height + BOUNDARY_EPSILON,
      )
    )
      throw new Error(
        '存在高于一页的不可拆分内容，请缩短该内容或调整字号与边距',
      )

    const segments =
      contentHeight > BOUNDARY_EPSILON
        ? buildPageSegments(boundaries, contentHeight, rect.height)
        : []

    return {
      id,
      segments,
      signature: {
        id,
        left: roundMetric(rect.left - pageRect.left),
        top: roundMetric(rect.top - pageRect.top),
        width: roundMetric(rect.width),
        height: roundMetric(rect.height),
        contentHeight: roundMetric(contentHeight),
        geometry,
        fontFamily:
          regionSource.ownerDocument.defaultView?.getComputedStyle(regionSource)
            .fontFamily ?? fontFamily,
      },
    }
  })

  const pageCount = Math.max(
    1,
    ...measured.map((region) => region.segments.length),
  )

  const pages = Array.from({ length: pageCount }, (_, index) => {
    const regions = measured.flatMap((region) =>
      region.segments[index]
        ? [{ id: region.id, ...region.segments[index] }]
        : [],
    )

    return {
      startKey: hash(
        regions.map((region) => `${region.id}:${region.startKey}`).join('|'),
      ),
      endKey: hash(
        regions.map((region) => `${region.id}:${region.endKey}`).join('|'),
      ),
      regions,
    }
  })

  const signature: ResumeLayoutSignature = {
    pageWidth: roundMetric(pageRect.width),
    pageHeight: roundMetric(pageRect.height),
    contentHeight: Math.max(
      0,
      ...measured.map((region) => region.signature.contentHeight),
    ),
    viewportWidth: roundMetric(viewport.getBoundingClientRect().width),
    viewportHeight: roundMetric(viewport.getBoundingClientRect().height),
    geometry: hash(
      measured
        .map((region) => `${region.id}:${region.signature.geometry}`)
        .join('|'),
    ),
    fontFamily,
    regions: measured.map((region) => region.signature),
    pages,
  }

  // segments 仅提供总页数和稳定的页面 key；正文裁切必须使用 regions 中的区间。
  const segments = pages.map((entry, index) => ({
    start: index,
    end: index + 1,
    startKey: entry.startKey,
    endKey: entry.endKey,
  }))

  if (!source.isConnected) throw new Error('简历测量文档已被替换')

  return {
    segments,
    regions: measured.map(({ id, segments }) => ({ id, segments })),
    signature,
  }
}
