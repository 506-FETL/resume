import { BoardView, DesktopList, MobileList } from '../components/views'

export function preloadTrackerView(mode: 'board' | 'list') {
  const mobile = window.matchMedia('(max-width: 767px)').matches

  return (
    mobile ? MobileList : mode === 'board' ? BoardView : DesktopList
  ).preload()
}
