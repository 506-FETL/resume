import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { hasAuthCallback } from '@/lib/auth/recovery-callback'
import { WORKSPACE_PATH } from '@/lib/workspace-path'
import {
  isWorkspaceHome,
  selectWorkspaceData,
} from '@/lib/workspace-data-route'

const { pathname, search, hash } = window.location
const isPublicHome = pathname === '/' && !hasAuthCallback

// 旧邮件回到根路径时，保留 SDK 尚未消费的验证码或令牌。
if (pathname === '/' && hasAuthCallback) {
  window.history.replaceState(
    window.history.state,
    '',
    `${WORKSPACE_PATH}${search}${hash}`,
  )
}

// 认证与界面并行加载；模块失败仍交给 App 的错误边界。
if (isWorkspaceHome(pathname) && !hasAuthCallback) {
  import('./components/auth-session/subscription')
    .then(({ startAuthSession }) => startAuthSession())
    .catch(() => {})

  selectWorkspaceData(true)
} else if (!isPublicHome) {
  import('./components/auth-session').catch(() => {})
}

// 首次工作台的外壳与页面并行取回；加载失败仍由实际路由展示错误。
if (!isPublicHome && !pathname.startsWith('/share/view/')) {
  import('./components/layout/dashboard-shell').catch(() => {})
}
if (isWorkspaceHome(pathname)) {
  import('./pages/index').catch(() => {})
}

const root = createRoot(document.getElementById('root')!)

async function loadPage() {
  if (isPublicHome) {
    const { default: PublicHomepage } = await import('./home')

    return <PublicHomepage />
  }

  const { default: WorkspaceApp } = await import('./workspace-app')

  document.title = 'GResume'

  return <WorkspaceApp />
}

loadPage().then(
  (page) => root.render(<StrictMode>{page}</StrictMode>),
  () => root.render(<p role='alert'>页面未能加载，请刷新后重试。</p>),
)
