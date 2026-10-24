import { SHARE_SEARCH_INPUT_ID } from '../const'
import useShareStore from '../store'

function focusSearchInput() {
  // 先将焦点移出即将退出的按钮，再更新状态，避免隐藏仍持有焦点的节点。
  document.getElementById(SHARE_SEARCH_INPUT_ID)?.focus({ preventScroll: true })
}

export function useShareFilterActions() {
  const resetFilters = useShareStore((state) => state.resetFilters)
  const setSearchKeyword = useShareStore((state) => state.setSearchKeyword)

  return {
    resetFilters() {
      focusSearchInput()
      resetFilters()
    },
    clearSearch() {
      focusSearchInput()
      setSearchKeyword('')
    },
  }
}
