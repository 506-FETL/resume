import { useEffect } from 'react'
import useAiQuotaStore from '@/store/ai-quota'

/**
 * 读取当前用户的 AI 每日额度。
 *
 * 底层复用全局 zustand store（`@/store/ai-quota`），因此 composer、账户菜单、
 * 用户中心多处同时挂载时只会发起一次请求，并共享同一份额度数据。
 * 首次挂载自动拉取；AI 发送成功 / 超额后可通过 `refetch` 校正。
 *
 * @returns quota 额度数据；loading 首次加载态；error 错误文案；refetch 手动刷新
 */
export function useAiQuota() {
  const quota = useAiQuotaStore(s => s.quota)
  const loading = useAiQuotaStore(s => s.loading)
  const error = useAiQuotaStore(s => s.error)
  const hasFetched = useAiQuotaStore(s => s.hasFetched)
  const fetchQuota = useAiQuotaStore(s => s.fetchQuota)

  useEffect(() => {
    if (!hasFetched)
      fetchQuota()
  }, [hasFetched, fetchQuota])

  return {
    quota,
    // 仅在尚无数据时暴露 loading，避免刷新时闪骨架
    loading: loading && !quota,
    error,
    refetch: fetchQuota,
  }
}
