import type { AiQuota } from '@/lib/supabase/quota'
import { create } from 'zustand'
import { getAiQuota } from '@/lib/supabase/quota'
import { getErrorMessage } from '@/utils'

interface AiQuotaStore {
  quota: AiQuota | null
  loading: boolean
  error: string | null
  // 是否已发起过首次拉取（用于 hook 避免重复初始化）
  hasFetched: boolean
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
  fetchQuota: async () => {
    if (inflight)
      return inflight
    set({ loading: true, error: null })
    inflight = (async () => {
      try {
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
