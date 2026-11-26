import type { AiQuota } from '@/lib/supabase/quota'
import { create } from 'zustand'
import supabase from '@/lib/supabase/client'
import { getAiQuota } from '@/lib/supabase/quota'
import { getErrorMessage } from '@/utils'

interface AiQuotaStore {
  quota: AiQuota | null
  loading: boolean
  error: string | null
  // 首次读取是否已完成
  hasFetched: boolean
  // 当前额度归属的用户 id（来自 onAuthStateChange 的权威 session）
  currentUserId: string | null | undefined
  // 拉取额度；并发去重，多个展示位同时挂载只会打一次请求
  fetchQuota: () => Promise<void>
  // 用 llm-proxy 预留响应中的权威额度更新展示，不猜测 light/heavy cost。
  applyReservation: (
    reservation: AiQuotaReservation,
    identity: AiQuotaRequestIdentity,
  ) => void
}

export interface AiQuotaReservation {
  remaining: number
  dailyLimit: number
  resetAt: string
  unlimited: boolean
}

export interface AiQuotaRequestIdentity {
  userId: string
  generation: number
}

// 模块级 in-flight，保证并发调用共享同一次请求
let inflight: Promise<void> | null = null
// 每次身份切换递增，防止 A -> B -> A 时第一次 A 的响应被接受。
let identityGeneration = 0

export function captureAiQuotaIdentity(userId: string): AiQuotaRequestIdentity {
  return { userId, generation: identityGeneration }
}

function isCurrentIdentity(
  identity: AiQuotaRequestIdentity,
  currentUserId: AiQuotaStore['currentUserId'],
) {
  return (
    identity.generation === identityGeneration &&
    identity.userId === currentUserId
  )
}

const useAiQuotaStore = create<AiQuotaStore>((set, get) => ({
  quota: null,
  loading: false,
  error: null,
  hasFetched: false,
  currentUserId: undefined,
  fetchQuota: () => {
    const userId = get().currentUserId

    if (!userId) return Promise.resolve()
    if (inflight) return inflight

    const identity = captureAiQuotaIdentity(userId)

    set({ loading: true, error: null })

    const request: Promise<void> = (async () => {
      try {
        // 直接查额度：supabase-js 会自动带上 storage 中「当前」的 access_token，
        // 而 onAuthStateChange 触发时 storage 已是最新 token，故这里拿到的是当前身份的额度。
        // 刻意不调用 auth.getUser()：它会发网络请求且存在已知的 hang/死锁问题，
        // 一旦卡住会让 inflight 永不 resolve，导致必须刷新页面才恢复。
        const quota = await getAiQuota()

        if (isCurrentIdentity(identity, get().currentUserId))
          set({ quota, loading: false, error: null, hasFetched: true })
      } catch (e) {
        if (isCurrentIdentity(identity, get().currentUserId))
          set({ loading: false, error: getErrorMessage(e), hasFetched: true })
      }
    })().finally(() => {
      if (inflight === request) inflight = null
    })

    inflight = request

    return request
  },
  applyReservation: (reservation, identity) => {
    if (!isCurrentIdentity(identity, get().currentUserId)) return

    const { quota } = get()

    if (!quota) return

    set({
      quota: {
        ...quota,
        dailyLimit: reservation.dailyLimit,
        remaining: reservation.remaining,
        usedToday: reservation.unlimited
          ? quota.usedToday
          : Math.max(0, reservation.dailyLimit - reservation.remaining),
        resetAt: reservation.resetAt,
        unlimited: reservation.unlimited,
      },
    })
  },
}))

export default useAiQuotaStore

// 非组件上下文（如 use-chat-stream 回调）刷新额度的便捷入口
export function refetchAiQuota() {
  return useAiQuotaStore.getState().fetchQuota()
}

export function applyAiQuotaReservation(
  reservation: AiQuotaReservation,
  identity: AiQuotaRequestIdentity,
) {
  useAiQuotaStore.getState().applyReservation(reservation, identity)
}

// 身份切换立即失效旧请求；额度由当前可见的展示位按需读取。
supabase.auth.onAuthStateChange((_event, session) => {
  const uid = session?.user?.id ?? null
  const state = useAiQuotaStore.getState()

  // 身份未变化：忽略（TOKEN_REFRESHED 等事件不需要重拉）
  if (state.currentUserId === uid) return

  // 身份变化（首屏 / 登录 / 登出 / 切换账号）：丢弃旧身份可能残留的 in-flight，清空旧额度
  identityGeneration += 1

  inflight = null

  useAiQuotaStore.setState({
    currentUserId: uid,
    quota: null,
    loading: false,
    error: null,
    hasFetched: false,
  })
})
