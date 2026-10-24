import type { ResumeLayoutSignature } from './types'

/** 检查每页实际裁切几何，不能只相信元素携带的分页标记。 */
export function validatePrintRegions(
  document: Document,
  signature: ResumeLayoutSignature,
) {
  const pages = Array.from(
    document.querySelectorAll<HTMLElement>('[data-resume-page]'),
  )
  const equal = (actual: number, expected: number) =>
    Number.isFinite(actual) && Math.abs(actual - expected) <= 0.05
  const fail = () => {
    throw new Error('打印区域分页与测量结果不一致')
  }
  if (pages.length !== signature.pages.length) fail()
  pages.forEach((page, index) => {
    const pageRect = page.getBoundingClientRect()
    const clips = Array.from(
      page.querySelectorAll<HTMLElement>('[data-resume-page-clip]'),
    )
    if (
      clips.length !== signature.regions.length ||
      !equal(pageRect.width, signature.pageWidth) ||
      !equal(pageRect.height, signature.pageHeight)
    ) {
      fail()
    }
    const seen = new Set<string>()
    clips.forEach((clip) => {
      const id = clip.dataset.resumePageClip ?? ''
      const geometry = signature.regions.find((region) => region.id === id)
      if (!geometry || seen.has(id)) return fail()
      seen.add(id)
      const segment = signature.pages[index].regions.find(
        (region) => region.id === id,
      )
      const viewport = clip.parentElement!
      const sources = clip.querySelectorAll<HTMLElement>(
        ':scope > [data-resume-region-source]',
      )
      if (
        viewport.dataset.resumeRegionViewport !== id ||
        sources.length !== 1 ||
        sources[0].dataset.resumeRegionSource !== id
      )
        return fail()
      const source = sources[0]
      const viewportRect = viewport.getBoundingClientRect()
      const clipRect = clip.getBoundingClientRect()
      const sourceRect = source.getBoundingClientRect()
      const start = segment?.start ?? 0
      const end = segment?.end ?? 0
      if (
        clip.dataset.startKey !== (segment?.startKey ?? 'start') ||
        clip.dataset.endKey !== (segment?.endKey ?? 'empty') ||
        !equal(Number(clip.dataset.regionStart), start) ||
        !equal(Number(clip.dataset.regionEnd), end) ||
        !equal(viewportRect.left - pageRect.left, geometry.left) ||
        !equal(viewportRect.top - pageRect.top, geometry.top) ||
        !equal(viewportRect.width, geometry.width) ||
        !equal(viewportRect.height, geometry.height) ||
        !equal(clipRect.left, viewportRect.left) ||
        !equal(clipRect.top, viewportRect.top) ||
        !equal(clipRect.width, geometry.width) ||
        !equal(clipRect.height, end - start) ||
        !equal(sourceRect.left, clipRect.left) ||
        !equal(sourceRect.top - clipRect.top, -start) ||
        !equal(sourceRect.width, geometry.width) ||
        document.defaultView?.getComputedStyle(clip).overflow !== 'hidden' ||
        document.defaultView?.getComputedStyle(viewport).overflow !== 'hidden'
      ) {
        fail()
      }
    })
  })
}
