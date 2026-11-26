import { create } from 'zustand'

// 只保留最近查看的一份官方示例。离开目录即释放其图片租约。
export interface PreviewPaper {
  key: string
  viewport: string
  pages: HTMLElement
  width: number
  height: number
  release: () => void
}

const useLastPaper = create<{ paper?: PreviewPaper }>(() => ({}))

export function previewViewport() {
  return `${window.innerWidth}@${window.devicePixelRatio}`
}

export function readPreviewPaper(key: string) {
  const { paper: lastPaper } = useLastPaper.getState()

  return lastPaper?.key === key && lastPaper.viewport === previewViewport()
    ? lastPaper
    : undefined
}

export function clearPreviewPaper() {
  const { paper } = useLastPaper.getState()

  if (!paper) return

  paper.release()
  useLastPaper.setState({ paper: undefined })
}

export function keepPreviewPaper(
  key: string,
  pages: HTMLElement,
  release: () => void,
) {
  useLastPaper.getState().paper?.release()

  useLastPaper.setState({
    paper: {
      key,
      viewport: previewViewport(),
      pages: pages.cloneNode(true) as HTMLElement,
      width: pages.offsetWidth,
      height: pages.offsetHeight,
      release,
    },
  })
}

export function useMatchingPreviewPaper(key: string) {
  return useLastPaper((state) =>
    state.paper?.key === key && state.paper.viewport === previewViewport()
      ? state.paper
      : undefined,
  )
}
