import { useEffect } from 'react'
import useAiQuotaStore from '@/store/ai-quota'

/**
 * 读取当前用户的 AI 每日额度。
 *
 * 底层复用全局 zustand store（`@/store/ai-quota`），因此 composer、账户菜单、
 * 用户中心多处同时挂载时只会发起一次请求，并共享同一份额度数据。
 *
 * 额度拉取由 store 内的 `onAuthStateChange` 订阅驱动（登录态权威来源）：
 * 首屏（INITIAL_SESSION）、登录、登出、切换账号时会自动按新身份重新拉取。
 * 这里仅做兜底：极端情况下（订阅尚未触发过拉取）在挂载时补一次。
 *
 * @returns quota 额度数据；loading 首次加载态；error 错误文案；refetch 手动刷新
 */
export function useAiQuota() {
  const quota = useAiQuotaStore(s => s.quota)
  const loading = useAiQuotaStore(s => s.loading)
  const error = useAiQuotaStore(s => s.error)
  const hasFetched = useAiQuotaStore(s => s.hasFetched)
  const currentUserId = useAiQuotaStore(s => s.currentUserId)
  const fetchQuota = useAiQuotaStore(s => s.fetchQuota)

  useEffect(() => {
    // 兜底：仅当登录态已确定为「已登录」(currentUserId 为真) 且尚未拉取过时补一次
    if (currentUserId && !hasFetched)
      fetchQuota()
  }, [currentUserId, hasFetched, fetchQuota])

  return {
    quota,
    // 仅在尚无数据时暴露 loading，避免刷新时闪骨架
    loading: loading && !quota,
    error,
    refetch: fetchQuota,
  }
}
