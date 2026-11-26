import { WORKSPACE_PATH } from './workspace-path'

let selected = false
let leave: (() => void) | undefined

export function isWorkspaceHome(pathname: string) {
  return pathname.replace(/\/+$/, '') === WORKSPACE_PATH
}

export function selectWorkspaceData(selectedHome: boolean) {
  if (selectedHome === selected) return

  selected = selectedHome

  if (!selected) {
    leave?.()

    return
  }

  import('@/pages/index/store')
    .then(({ default: store }) => {
      if (!selected || !isWorkspaceHome(window.location.pathname)) return

      leave = store.getState().leavePage
      store.getState().openPage()
    })
    .catch(() => {
      // 页面本身也依赖此模块，由正常路由呈现分包错误和重试入口。
      selected = false
    })
}
