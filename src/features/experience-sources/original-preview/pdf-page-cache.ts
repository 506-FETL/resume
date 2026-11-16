interface CachedPage {
  canvas: HTMLCanvasElement
  availableWidth: number
  pixelRatio: number
  pageCount: number
}

// 仅保留最近一次首屏，弱引用随原件 Blob 的账户/版本缓存一起失效。
let firstPage = new WeakMap<Blob, CachedPage>()

export function getPdfFirstPage(
  blob: Blob,
  availableWidth: number,
  pixelRatio: number,
) {
  const cached = firstPage.get(blob)

  if (
    cached?.availableWidth === availableWidth &&
    cached.pixelRatio === pixelRatio
  )
    return cached
}

export function cachePdfFirstPage(blob: Blob, page: CachedPage) {
  firstPage = new WeakMap([[blob, page]])
}

export function copyPdfCanvas(source: HTMLCanvasElement) {
  const canvas = source.cloneNode() as HTMLCanvasElement

  canvas.getContext('2d')!.drawImage(source, 0, 0)

  return canvas
}
