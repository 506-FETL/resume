export const DASHBOARD_SIDEBAR_WIDTH = '14rem'

export function readSidebarOpen() {
  try {
    return localStorage.getItem('sidebarOpen') !== 'false'
  } catch {
    return true
  }
}
