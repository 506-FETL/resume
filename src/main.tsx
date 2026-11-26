import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { dashboardShell } from '@/components/layout/load-dashboard-shell'
import { hasAuthCallback } from '@/lib/auth/recovery-callback'
import {
  isExperienceArchive,
  selectExperienceArchive,
} from '@/lib/experience-route'
import {
  isResumeLibrary,
  resumeLibraryPage,
  selectResumeLibrary,
} from '@/lib/resume-library-route'
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
const libraryRoute = isResumeLibrary(pathname)
const archiveRoute = isExperienceArchive(pathname)
const gatedLibrary = Boolean(new URLSearchParams(search).get('jobId'))

if (
  (isWorkspaceHome(pathname) || libraryRoute || archiveRoute) &&
  !hasAuthCallback
) {
  import('./components/auth-session/subscription')
    .then(({ startAuthSession }) => startAuthSession())
    .catch(() => {})

  if (libraryRoute && !gatedLibrary) selectResumeLibrary(true)
  if (archiveRoute)
    selectExperienceArchive(window.history.state?.key ?? 'default')
  if (isWorkspaceHome(pathname)) selectWorkspaceData(true)
} else if (!isPublicHome) {
  import('./components/auth-session').catch(() => {})
}

// 首次工作台的外壳与页面并行取回；加载失败仍由实际路由展示错误。
if (!isPublicHome && !pathname.startsWith('/share/view/')) {
  dashboardShell.load().catch(() => {})
}
if (isWorkspaceHome(pathname)) {
  import('./pages/index').catch(() => {})
} else if (libraryRoute) {
  resumeLibraryPage.load().catch(() => {})
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
