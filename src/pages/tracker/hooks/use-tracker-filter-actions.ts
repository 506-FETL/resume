import { TRACKER_SEARCH_INPUT_ID } from '../const'
import useTrackerStore from '../store'

function focusSearchInput() {
  // 在状态更新前移出即将退出的按钮，避免焦点留在隐藏节点内。
  document
    .getElementById(TRACKER_SEARCH_INPUT_ID)
    ?.focus({ preventScroll: true })
}

export function useTrackerFilterActions() {
  const clearFilters = useTrackerStore((state) => state.clearFilters)
  const setSearchKeyword = useTrackerStore((state) => state.setSearchKeyword)
  const setShowArchived = useTrackerStore((state) => state.setShowArchived)

  return {
    focusSearchInput,
    clearFilters() {
      focusSearchInput()
      clearFilters()
    },
    clearSearch() {
      focusSearchInput()
      setSearchKeyword('')
    },
    clearSearchAndFilters() {
      focusSearchInput()
      clearFilters()
      setSearchKeyword('')
    },
    setShowArchived(value: boolean) {
      focusSearchInput()
      setShowArchived(value)
    },
  }
}
