import { createOwnerResumeLoader } from './owner'
import type { LoadedDocumentIdentity } from './route'
import { parseCollaborationRoute, getCollaborationLoadKey } from './route'
import { hydrateLoadedAppearance, isOwnerMustHostError } from './appearance'
import { useResumeLoaderCleanup, useResumeDeletion } from './lifecycle'
import { canReuseLoadedDocument } from './reuse'
import type { PreparedGuestSession } from '@/lib/collaboration'
import { useEffect, useRef, useState } from 'react'
import {
  matchPath,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
import { toast } from 'sonner'
import { getUserDisplayName } from '@/hooks/use-current-user'
import { sanitizeAppRedirect } from '@/lib/auth/redirect'
import {
  CollaborationOperationError,
  getStoredSessionRole,
  useCollaborationStore,
} from '@/lib/collaboration'
import { isResumeNotFoundError } from '@/lib/resume-id'
import useResumeConfigStore from '@/store/resume/config'
import useCurrentResumeStore from '@/store/resume/current'
import useResumeStore from '@/store/resume/form'
import useUserStore from '@/store/user'
import { getErrorMessage } from '@/utils'

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

  const { resumeId, setCurrentResume, clearCurrentResume } =
    useCurrentResumeStore()

  const loadResumeData = useResumeStore((state) => state.loadResumeData)
  const currentUser = useUserStore((state) => state.currentUser)
  const authStatus = useUserStore((state) => state.authStatus)

  const collaborationRoute = parseCollaborationRoute(searchParams)
  const queryResumeId = searchParams.get('resumeId')

  const routeResumeId =
    collaborationRoute.kind === 'invite' ||
    collaborationRoute.kind === 'host-recovery'
      ? collaborationRoute.resumeId
      : undefined

  const activeResumeId = routeResumeId ?? queryResumeId ?? resumeId ?? undefined
  const loadKey = getCollaborationLoadKey(collaborationRoute, activeResumeId)

  const collaborationAuthKey =
    collaborationRoute.kind === 'invite' ||
    collaborationRoute.kind === 'host-recovery'
      ? `${authStatus}:${currentUser?.id ?? 'none'}`
      : 'owner'

  useResumeLoaderCleanup()

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

    const isCurrentLoad = () =>
      !cancelled && generation === loadGenerationRef.current

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
      ? getUserDisplayName(authenticatedUser) ||
        `用户-${authenticatedUser.id.slice(0, 6)}`
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

    // 已加载的 owner 文档不因 host 开启/停止时的 URL source 变化重建。
    // 门禁位于 discard/loading/loadResumeData/resumeHosting 之前，因此是真正的 no-op。
    if (
      canReuseLoadedDocument(
        route,
        activeResumeId,
        loadKey,
        loadedDocumentIdentityRef.current,
        authState,
      )
    ) {
      setLoading(false)

      return () => {
        cancelled = true
      }
    }

    const isCollaborationRoute =
      route.kind === 'invite' || route.kind === 'host-recovery'

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

        navigate(`/login?redirect=${encodeURIComponent(redirect)}`, {
          replace: true,
        })
      })

      return () => {
        cancelled = true
      }
    }

    if (
      isCollaborationRoute &&
      (!authenticatedUserId || authState.authStatus !== 'authenticated')
    ) {
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
        throw new CollaborationOperationError('简历加载已被新的请求替代', {
          code: 'session_changed',
        })
    }

    const loadOwnerResume = createOwnerResumeLoader(
      loadResumeData,
      loadedDocumentIdentityRef,
      assertCurrentLoad,
    )

    const resumeHost = async (params: {
      sessionId: string
      resumeId: string
      userId: string
      userName: string
    }) => {
      try {
        await useCollaborationStore.getState().resumeHosting(params)
      } catch (error) {
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

        const storedRole = getStoredSessionRole(
          route.sessionId,
          route.resumeId,
          userId,
        )

        if (storedRole === 'host') {
          await loadOwnerResume(route.resumeId)
          assertCurrentLoad()
          await resumeHost(params)

          return
        }

        try {
          preparedGuest = await useCollaborationStore
            .getState()
            .prepareGuestSession(params)
        } catch (error) {
          if (!isOwnerMustHostError(error)) throw error

          assertCurrentLoad()
          await loadOwnerResume(route.resumeId)
          assertCurrentLoad()
          await resumeHost(params)

          return
        }

        if (!isCurrentLoad()) {
          await useCollaborationStore
            .getState()
            .abortPreparedGuestSession(preparedGuest)

          preparedGuest = null

          return
        }

        if (route.kind === 'host-recovery') {
          await useCollaborationStore
            .getState()
            .abortPreparedGuestSession(preparedGuest)

          preparedGuest = null

          throw new CollaborationOperationError('协作链接缺少共享文档信息', {
            code: 'collaboration_document_missing',
          })
        }

        useCollaborationStore
          .getState()
          .markGuestSessionHydrating(preparedGuest)

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

        await useCollaborationStore
          .getState()
          .connectPreparedGuestSession(preparedGuest)

        assertCurrentLoad()

        loadedDocumentIdentityRef.current = {
          resumeId: route.resumeId,
          source: 'collaboration',
          loadKey,
        }

        preparedGuest = null
        toast.info('已加入实时协作', { description: '正在与发起者同步内容' })
      } catch (error) {
        if (preparedGuest) {
          await useCollaborationStore
            .getState()
            .abortPreparedGuestSession(preparedGuest)

          preparedGuest = null
        }
        if (!isCurrentLoad()) return

        if (
          isResumeNotFoundError(error) &&
          useCurrentResumeStore.getState().resumeId === activeResumeId
        )
          clearCurrentResume()

        runTerminalActionOnce('load-error', () => {
          if (!sessionActionReportedError) {
            toast.error(`加载简历失败, ${getErrorMessage(error, '未知错误')}`)
          }

          navigate('/resume', { replace: true })
        })
      } finally {
        if (isCurrentLoad()) setLoading(false)
      }
    }

    // StrictMode 会在本轮挂载中立即清理并重开 effect。过期的邀请不能先占用 v1 成员租约。
    queueMicrotask(() => {
      if (!isCurrentLoad()) return

      runLoad().catch((error) => {
        console.warn('[resume-loader] unexpected load failure:', error)
      })
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

  useResumeDeletion(activeResumeId, currentUser)

  return {
    loading,
    currentUser,
    activeResumeId,
  }
}
