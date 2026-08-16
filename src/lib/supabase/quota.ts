import supabase from './client'

// AI 每日额度（加权积分制）。字段与 get_ai_quota() 返回一致，转成前端 camelCase。
export interface AiQuota {
  plan: string
  dailyLimit: number
  usedToday: number
  remaining: number
  lastResetDate: string
  quotaDate: string
  resetAt: string
  unlimited: boolean
}

interface RawAiQuota {
  plan: string
  daily_limit: number
  used_today: number
  remaining: number
  last_reset_date: string
  quota_date: string
  reset_at: string
  unlimited: boolean
}

// 只读当前登录用户的 UTC 日桶；函数不会写入或取行锁。
export async function getAiQuota(): Promise<AiQuota> {
  const { data, error } = await supabase.rpc('get_ai_quota')

  if (error)
    throw error

  const raw = (data ?? {}) as Partial<RawAiQuota>
  return {
    plan: raw.plan ?? 'free',
    dailyLimit: raw.daily_limit ?? 0,
    usedToday: raw.used_today ?? 0,
    remaining: raw.remaining ?? 0,
    lastResetDate: raw.last_reset_date ?? '',
    quotaDate: raw.quota_date ?? raw.last_reset_date ?? '',
    resetAt: raw.reset_at ?? '',
    unlimited: raw.unlimited ?? false,
  }
}
