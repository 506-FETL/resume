import type { PageSegment, ResumeLayoutSignature } from '../types'
import { roundMetric } from './metrics'

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

  const contentHeight =
    segments.at(-1)?.end ??
    Math.max(source.scrollHeight, source.getBoundingClientRect().height)

  return {
    pageWidth: roundMetric(pageRect.width),
    pageHeight: roundMetric(pageRect.height),
    contentHeight: roundMetric(contentHeight),
    viewportWidth: roundMetric(viewport.getBoundingClientRect().width),
    viewportHeight: roundMetric(viewport.getBoundingClientRect().height),
    geometry,
    fontFamily,
    regions: [
      {
        id: 'main',
        left: 0,
        top: 0,
        width: roundMetric(viewport.getBoundingClientRect().width),
        height: roundMetric(viewport.getBoundingClientRect().height),
        contentHeight: roundMetric(contentHeight),
        geometry,
        fontFamily,
      },
    ],
    pages: segments.map((segment) => ({
      startKey: segment.startKey,
      endKey: segment.endKey,
      regions: [{ id: 'main', ...segment }],
    })),
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
