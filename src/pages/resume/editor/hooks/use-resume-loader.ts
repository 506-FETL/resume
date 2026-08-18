import type { AutomergeUrl } from '@automerge/automerge-repo'
import type { PreparedGuestSession } from '@/lib/collaboration'
import type { ResumeLoadResult } from '@/store/resume/helpers/sync-service'
import { parseAutomergeUrl } from '@automerge/automerge-repo'
import { useEffect, useRef, useState } from 'react'
import { matchPath, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { getUserDisplayName } from '@/hooks/use-current-user'
import { sanitizeAppRedirect } from '@/lib/auth/redirect'
import {
  CollaborationOperationError,
  getStoredSessionRole,
  useCollaborationStore,
} from '@/lib/collaboration'
import { isOfflineResumeId } from '@/lib/offline-resume-manager'
import { isResumeNotFoundError } from '@/lib/resume-id'
import { DEFAULT_RESUME_APPEARANCE } from '@/lib/schema'
import { subscribeToResumeConfigUpdates } from '@/lib/supabase/resume'
import useResumeConfigStore from '@/store/resume/config'
import useCurrentResumeStore from '@/store/resume/current'
import useResumeStore from '@/store/resume/form'
import useUserStore from '@/store/user'
import { getErrorMessage } from '@/utils'

type CollaborationRoute
  = | { kind: 'none' }
    | {
      kind: 'invite'
      resumeId: string
      sessionId: string
      documentUrl: string
      documentId: string
    }
    | { kind: 'host-recovery', resumeId: string, sessionId: string }
    | { kind: 'invalid' }

interface LoadedDocumentIdentity {
  resumeId: string
  source: 'owner' | 'collaboration'
  loadKey: string
}

function parseCollaborationRoute(params: URLSearchParams): CollaborationRoute {
  const hasSessionId = params.has('collabSession')
  const hasDocumentUrl = params.has('docUrl')
  const resumeId = params.get('resumeId')
  const sessionId = params.get('collabSession')
  const documentUrl = params.get('docUrl')

  if (!hasSessionId && !hasDocumentUrl)
    return { kind: 'none' }
  if (resumeId && sessionId && hasSessionId && !hasDocumentUrl)
    return { kind: 'host-recovery', resumeId, sessionId }
  if (!resumeId || !sessionId || !documentUrl)
    return { kind: 'invalid' }

  try {
    const { documentId } = parseAutomergeUrl(documentUrl as AutomergeUrl)
    return {
      kind: 'invite',
      resumeId,
      sessionId,
      documentUrl,
      documentId,
    }
  }
  catch {
    return { kind: 'invalid' }
  }
}

function getCollaborationLoadKey(
  route: CollaborationRoute,
  activeResumeId?: string,
) {
  if (route.kind === 'invalid')
    return 'collab:invalid'
  if (route.kind === 'invite')
    return `collab:${route.resumeId}:${route.sessionId}:${route.documentId}`
  return activeResumeId ? `resume:${activeResumeId}` : 'empty'
}

function hydrateLoadedAppearance(
  result: ResumeLoadResult,
  options: { collaborationSource: boolean },
) {
  const { snapshot, hasPersistedAppearance, cloudAppearanceStatus, mode } = result
  const configStore = useResumeConfigStore.getState()

  if (
    options.collaborationSource
    || mode !== 'online'
    || hasPersistedAppearance
    || cloudAppearanceStatus === 'error'
  ) {
    configStore.hydrateFromSnapshot(snapshot)
    return
  }

  const legacyConfig = configStore.readLegacyLocalConfig()
  const fallbackAppearance = legacyConfig ?? DEFAULT_RESUME_APPEARANCE

  configStore.replaceConfig(fallbackAppearance)
  useResumeStore.getState().updateAppearanceConfig(fallbackAppearance)
}

function isOwnerMustHostError(error: unknown) {
  return error instanceof CollaborationOperationError && error.code === 'owner_must_host'
}

export function useResumeLoader() {
  const [loading, setLoading] = useState(true)
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const loadGenerationRef = useRef(0)
  const locationHashRef = useRef(location.hash)
  locationHashRef.current = location.hash
  const terminalActionKeyRef = useRef<string | null>(null)
  const loadedDocumentIdentityRef = useRef<LoadedDocumentIdentity | null>(null)

  const { resumeId, setCurrentResume, clearCurrentResume } = useCurrentResumeStore()
  const loadResumeData = useResumeStore(state => state.loadResumeData)
  const currentUser = useUserStore(state => state.currentUser)
  const authStatus = useUserStore(state => state.authStatus)

  const collaborationRoute = parseCollaborationRoute(searchParams)
  const queryResumeId = searchParams.get('resumeId')
  const routeResumeId = collaborationRoute.kind === 'invite'
    || collaborationRoute.kind === 'host-recovery'
    ? collaborationRoute.resumeId
    : undefined
  const activeResumeId = routeResumeId ?? queryResumeId ?? resumeId ?? undefined
  const loadKey = getCollaborationLoadKey(collaborationRoute, activeResumeId)
  const collaborationAuthKey = collaborationRoute.kind === 'invite'
    || collaborationRoute.kind === 'host-recovery'
    ? `${authStatus}:${currentUser?.id ?? 'none'}`
    : 'owner'

  // 先发起服务端 leave/revoke，再销毁本地文档，避免卸载时留下幽灵成员。
  useEffect(() => {
    return () => {
      useResumeConfigStore.getState().discardSpacingPreview()
      useCollaborationStore.getState().stopSharing({
        silent: true,
        bestEffort: true,
      }).catch(() => undefined)
      useResumeStore.getState().cleanup()
    }
  }, [])

  // 处理 URL 参数切换简历
  useEffect(() => {
    if (queryResumeId && queryResumeId !== resumeId) {
      setCurrentResume(queryResumeId, 'default')
    }
  }, [resumeId, queryResumeId, setCurrentResume])

  // effect 只以稳定文档身份为键；host 只追加 session 参数时 loadKey 不变，
  // 因而不会销毁已连接的 DocumentManager。
  useEffect(() => {
    let cancelled = false
    const generation = ++loadGenerationRef.current
    const isCurrentLoad = () => !cancelled && generation === loadGenerationRef.current

    // DashboardShell 会在路由切换时保留退出动画中的 Editor。此时组件仍会收到新 location，
    // 必须在解析 query / 加载文档前停住，否则登录页的 redirect query 会被误判为 owner 路由。
    if (!matchPath('/resume/editor', location.pathname)) {
      return () => {
        cancelled = true
      }
    }

    const route = parseCollaborationRoute(new URLSearchParams(location.search))
    const authState = useUserStore.getState()
    const authenticatedUser = authState.currentUser
    const authenticatedUserId = authenticatedUser?.id ?? null
    const authenticatedUserName = authenticatedUser
      ? getUserDisplayName(authenticatedUser) || `用户-${authenticatedUser.id.slice(0, 6)}`
      : ''

    const runTerminalActionOnce = (key: string, action: () => void) => {
      const terminalKey = `${loadKey}:${key}`
      if (!isCurrentLoad() || terminalActionKeyRef.current === terminalKey)
        return
      terminalActionKeyRef.current = terminalKey
      action()
    }

    if (route.kind === 'invalid') {
      setLoading(false)
      runTerminalActionOnce('invalid', () => {
        toast.error('协作链接无效')
        navigate('/resume', { replace: true })
      })
      return () => {
        cancelled = true
      }
    }

    if (!activeResumeId) {
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    const expectedDocumentSource = route.kind === 'invite' ? 'collaboration' : 'owner'
    const loadedIdentity = loadedDocumentIdentityRef.current
    const resumeState = useResumeStore.getState()
    const hasReusableDocument = loadedIdentity?.resumeId === activeResumeId
      && loadedIdentity.source === expectedDocumentSource
      && loadedIdentity.loadKey === loadKey
      && resumeState.currentResumeId === activeResumeId
      && resumeState.isInitialized
      && resumeState.docManager !== null
      && resumeState.docManager.canPersist() === (expectedDocumentSource === 'owner')
    const collaborationState = useCollaborationStore.getState()
    const isCurrentHostUrlTransition = route.kind === 'host-recovery'
      && collaborationState.role === 'host'
      && collaborationState.sessionId === route.sessionId
      && collaborationState.resumeId === route.resumeId
      && authState.authStatus === 'authenticated'
      && authenticatedUserId === collaborationState.self?.userId
      && collaborationState.isSharing

    // 已加载的 owner 文档不因 host 开启/停止时的 URL source 变化重建。
    // 门禁位于 discard/loading/loadResumeData/resumeHosting 之前，因此是真正的 no-op。
    if (hasReusableDocument && (route.kind === 'none' || isCurrentHostUrlTransition)) {
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    const isCollaborationRoute = route.kind === 'invite' || route.kind === 'host-recovery'
    if (isCollaborationRoute && authState.authStatus === 'unknown') {
      setLoading(true)
      useCollaborationStore.getState().markInviteAuthenticating()
      return () => {
        cancelled = true
      }
    }

    if (isCollaborationRoute && authState.authStatus === 'anonymous') {
      setLoading(true)
      runTerminalActionOnce('login', () => {
        const redirect = sanitizeAppRedirect(
          `${location.pathname}${location.search}${locationHashRef.current}`,
        )
        navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true })
      })
      return () => {
        cancelled = true
      }
    }

    if (isCollaborationRoute && (!authenticatedUserId || authState.authStatus !== 'authenticated')) {
      setLoading(true)
      useCollaborationStore.getState().markInviteAuthenticating()
      return () => {
        cancelled = true
      }
    }

    useResumeConfigStore.getState().discardSpacingPreview()
    setLoading(true)

    let preparedGuest: PreparedGuestSession | null = null
    let sessionActionReportedError = false

    const assertCurrentLoad = () => {
      if (!isCurrentLoad())
        throw new CollaborationOperationError('简历加载已被新的请求替代', { code: 'session_changed' })
    }

    const loadOwnerResume = async (targetResumeId: string) => {
      const currentIdentity = loadedDocumentIdentityRef.current
      const currentResumeState = useResumeStore.getState()
      if (
        currentIdentity?.resumeId === targetResumeId
        && currentIdentity.source === 'owner'
        && currentResumeState.currentResumeId === targetResumeId
        && currentResumeState.isInitialized
        && currentResumeState.docManager?.canPersist() === true
      ) {
        return
      }

      const result = await loadResumeData(targetResumeId, { source: { kind: 'owner' } })
      assertCurrentLoad()
      hydrateLoadedAppearance(result, { collaborationSource: false })
      loadedDocumentIdentityRef.current = {
        resumeId: targetResumeId,
        source: 'owner',
        loadKey: `resume:${targetResumeId}`,
      }
    }

    const resumeHost = async (params: {
      sessionId: string
      resumeId: string
      userId: string
      userName: string
    }) => {
      try {
        await useCollaborationStore.getState().resumeHosting(params)
      }
      catch (error) {
        // session store 会展示恢复 host 失败的唯一一条 toast。
        sessionActionReportedError = true
        throw error
      }
      assertCurrentLoad()
    }

    const runLoad = async () => {
      try {
        if (route.kind === 'none') {
          await loadOwnerResume(activeResumeId)
          return
        }

        const userId = authenticatedUserId!
        const params = {
          sessionId: route.sessionId,
          resumeId: route.resumeId,
          userId,
          userName: authenticatedUserName,
        }
        const storedRole = getStoredSessionRole(route.sessionId, route.resumeId, userId)

        if (storedRole === 'host') {
          await loadOwnerResume(route.resumeId)
          assertCurrentLoad()
          await resumeHost(params)
          return
        }

        try {
          preparedGuest = await useCollaborationStore.getState().prepareGuestSession(params)
        }
        catch (error) {
          if (!isOwnerMustHostError(error))
            throw error

          assertCurrentLoad()
          await loadOwnerResume(route.resumeId)
          assertCurrentLoad()
          await resumeHost(params)
          return
        }

        if (!isCurrentLoad()) {
          await useCollaborationStore.getState().abortPreparedGuestSession(preparedGuest)
          preparedGuest = null
          return
        }

        if (route.kind === 'host-recovery') {
          await useCollaborationStore.getState().abortPreparedGuestSession(preparedGuest)
          preparedGuest = null
          throw new CollaborationOperationError('协作链接缺少共享文档信息', {
            code: 'collaboration_document_missing',
          })
        }

        useCollaborationStore.getState().markGuestSessionHydrating(preparedGuest)
        const result = await loadResumeData(route.resumeId, {
          source: {
            kind: 'collaboration',
            documentUrl: route.documentUrl,
            documentData: preparedGuest.authorization.bootstrap.documentData,
            sessionId: route.sessionId,
          },
        })
        assertCurrentLoad()
        hydrateLoadedAppearance(result, { collaborationSource: true })
        await useCollaborationStore.getState().connectPreparedGuestSession(preparedGuest)
        assertCurrentLoad()
        loadedDocumentIdentityRef.current = {
          resumeId: route.resumeId,
          source: 'collaboration',
          loadKey,
        }
        preparedGuest = null
        toast.info('已加入实时协作', { description: '正在与发起者同步内容' })
      }
      catch (error) {
        if (preparedGuest) {
          await useCollaborationStore.getState().abortPreparedGuestSession(preparedGuest)
          preparedGuest = null
        }
        if (!isCurrentLoad())
          return

        if (isResumeNotFoundError(error) && useCurrentResumeStore.getState().resumeId === activeResumeId)
          clearCurrentResume()

        runTerminalActionOnce('load-error', () => {
          if (!sessionActionReportedError) {
            toast.error(`加载简历失败, ${getErrorMessage(error, '未知错误')}`)
          }
          navigate('/resume', { replace: true })
        })
      }
      finally {
        if (isCurrentLoad())
          setLoading(false)
      }
    }

    runLoad().catch((error) => {
      console.warn('[resume-loader] unexpected load failure:', error)
    })

    return () => {
      cancelled = true
    }
  }, [
    activeResumeId,
    clearCurrentResume,
    collaborationAuthKey,
    loadKey,
    loadResumeData,
    location.pathname,
    location.search,
    navigate,
  ])

  // 监听简历删除
  useEffect(() => {
    if (!activeResumeId || isOfflineResumeId(activeResumeId) || !currentUser)
      return

    let unSubscribe: (() => void) | undefined
    let cancelled = false

    subscribeToResumeUpdates()

    async function subscribeToResumeUpdates() {
      try {
        unSubscribe = await subscribeToResumeConfigUpdates((payload) => {
          if (cancelled)
            return
          if (payload.eventType !== 'DELETE')
            return

          const deletedResumeId = payload.old.resume_id
          if (deletedResumeId !== activeResumeId)
            return

          const resumeName = payload.old.display_name || '简历'
          toast.error(`简历 "${resumeName}" 已在其他窗口被删除`, {
            duration: 5000,
          })

          navigate('/resume')
        })
      }
      catch (error: unknown) {
        toast.error(`监听简历更新失败, ${getErrorMessage(error, '未知错误')}`)
      }
    }

    return () => {
      cancelled = true
      unSubscribe?.()
    }
  }, [activeResumeId, currentUser, navigate])

  return {
    loading,
    currentUser,
    activeResumeId,
  }
}
