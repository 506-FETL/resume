import type { AiQuota } from '@/lib/supabase/quota'
import { create } from 'zustand'
import supabase from '@/lib/supabase/client'
import { getAiQuota } from '@/lib/supabase/quota'
import { getErrorMessage } from '@/utils'

interface AiQuotaStore {
  quota: AiQuota | null
  loading: boolean
  error: string | null
  // 是否已发起过首次拉取（hook 兜底用）
  hasFetched: boolean
  // 当前额度归属的用户 id（来自 onAuthStateChange 的权威 session）
  currentUserId: string | null | undefined
  // 拉取额度；并发去重，多个展示位同时挂载只会打一次请求
  fetchQuota: () => Promise<void>
  // 乐观递减：AI 发送后先本地减一，完成/超额后再 fetchQuota 校正
  decrementOptimistic: () => void
}

// 模块级 in-flight，保证并发调用共享同一次请求
let inflight: Promise<void> | null = null

const useAiQuotaStore = create<AiQuotaStore>((set, get) => ({
  quota: null,
  loading: false,
  error: null,
  hasFetched: false,
  currentUserId: undefined,
  fetchQuota: async () => {
    if (inflight)
      return inflight
    set({ loading: true, error: null })
    inflight = (async () => {
      try {
        // 直接查额度：supabase-js 会自动带上 storage 中「当前」的 access_token，
        // 而 onAuthStateChange 触发时 storage 已是最新 token，故这里拿到的是当前身份的额度。
        // 刻意不调用 auth.getUser()：它会发网络请求且存在已知的 hang/死锁问题，
        // 一旦卡住会让 inflight 永不 resolve，导致必须刷新页面才恢复。
        const quota = await getAiQuota()
        set({ quota, loading: false, error: null, hasFetched: true })
      }
      catch (e) {
        set({ loading: false, error: getErrorMessage(e), hasFetched: true })
      }
      finally {
        inflight = null
      }
    })()
    return inflight
  },
  decrementOptimistic: () => {
    const { quota } = get()
    if (!quota)
      return
    const remaining = Math.max(0, quota.remaining - 1)
    set({ quota: { ...quota, remaining, usedToday: quota.usedToday + 1 } })
  },
}))

export default useAiQuotaStore

// 非组件上下文（如 use-chat-stream 回调）刷新额度的便捷入口
export function refetchAiQuota() {
  return useAiQuotaStore.getState().fetchQuota()
}

// 非组件上下文乐观递减
export function decrementAiQuota() {
  useAiQuotaStore.getState().decrementOptimistic()
}

// ============ 登录态权威来源：onAuthStateChange ============
// 依据 Supabase 官方文档：
//   1. 回调携带的 `session` 是客户端登录态的权威来源（含最新 access_token），
//      比缓存的 user 状态或 getUser() 更可靠；
//   2. 回调内不能 await 其它 supabase 方法（auth 锁会死锁），需 setTimeout 推迟；
//   3. INITIAL_SESSION 会在订阅时补发一次，用于首屏初始化。
// 因此这里用 session.user.id 作为权威身份，身份变化即清空旧额度并重新拉取。
supabase.auth.onAuthStateChange((_event, session) => {
  const uid = session?.user?.id ?? null
  const state = useAiQuotaStore.getState()

  // 身份未变化：忽略（TOKEN_REFRESHED 等事件不需要重拉）
  if (state.currentUserId === uid)
    return

  // 身份变化（首屏 / 登录 / 登出 / 切换账号）：丢弃旧身份可能残留的 in-flight，清空旧额度
  inflight = null
  useAiQuotaStore.setState({
    currentUserId: uid,
    quota: null,
    error: null,
    hasFetched: false,
  })

  // 有登录用户则按新身份重新拉取；登出（uid=null）保持清空。
  // setTimeout(0) 让本次 auth 回调先返回、锁释放、新 token 落地，再发 rpc。
  if (uid)
    setTimeout(() => useAiQuotaStore.getState().fetchQuota(), 0)
})
