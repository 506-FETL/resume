export const WORKSPACE_PATH = '/workspace'

/** 旧链接里的根路径表示工作台首页，查询参数和锚点仍属于原页面。 */
export function resolveLegacyWorkspacePath(path: string) {
  return path.replace(/^\/(?=[?#]|$)/, WORKSPACE_PATH)
}
