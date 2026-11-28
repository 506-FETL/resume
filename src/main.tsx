import { StrictMode } from 'react'
import { preload } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { dashboardShell } from '@/components/layout/load-dashboard-shell'
import { isAssistantPage, selectAssistantPage } from '@/lib/assistant-route'
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
import {
  isShareManagement,
  selectShareManagement,
} from '@/lib/share-management-route'
import {
  isTemplateGallery,
  selectTemplateGallery,
} from '@/lib/template-gallery-route'
import { isHistoryPage, selectHistoryPage } from '@/lib/history-route'
import { isOptimizePage, selectOptimizePage } from '@/lib/optimize-route'
import { isTrackerPage, selectTrackerPage } from '@/lib/tracker-route'
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
const assistantRoute = isAssistantPage(pathname)
const trackerRoute = isTrackerPage(pathname)
const loadWorkspaceApp = () => import('./workspace-app')
const galleryRoute = isTemplateGallery(pathname)

const historyRoute = isHistoryPage(pathname)
const optimizeRoute = isOptimizePage(pathname)

const earlyWorkspaceApp =
  trackerRoute || galleryRoute || optimizeRoute || historyRoute
    ? loadWorkspaceApp()
    : undefined

const shareRoute = isShareManagement(pathname)
const archiveRoute = isExperienceArchive(pathname)
const gatedLibrary = Boolean(new URLSearchParams(search).get('jobId'))

if (
  (isWorkspaceHome(pathname) ||
    libraryRoute ||
    archiveRoute ||
    assistantRoute ||
    shareRoute ||
    trackerRoute ||
    galleryRoute ||
    optimizeRoute ||
    historyRoute) &&
  !hasAuthCallback
) {
  import('./components/auth-session/subscription')
    .then(({ startAuthSession }) => startAuthSession())
    .catch(() => {})

  if (shareRoute && !new URLSearchParams(search).has('jobId'))
    selectShareManagement(true)
  if (trackerRoute) selectTrackerPage(true)
  if (galleryRoute) selectTemplateGallery(true)
  if (historyRoute)
    selectHistoryPage(true, new URLSearchParams(search).get('jobId') || null)
  if (optimizeRoute)
    selectOptimizePage(true, new URLSearchParams(search).get('jobId') || null)
  if (assistantRoute) selectAssistantPage(true)
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
    for (const font of [
      new URL('./home/assets/sketch-cjk.woff2', import.meta.url),
      new URL('./home/assets/sketch-latin.woff2', import.meta.url),
    ]) {
      preload(font.href, {
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      })
    }

    const { default: PublicHomepage } = await import('./home')

    return <PublicHomepage />
  }

  const { default: WorkspaceApp } = await (earlyWorkspaceApp ??
    loadWorkspaceApp())

  document.title = 'GResume'

  return <WorkspaceApp />
}

loadPage().then(
  (page) => root.render(<StrictMode>{page}</StrictMode>),
  () => root.render(<p role='alert'>页面未能加载，请刷新后重试。</p>),
)
