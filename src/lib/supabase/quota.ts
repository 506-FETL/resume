import supabase from './client'

// AI 每日额度（加权积分制）。字段与 get_ai_quota() 返回一致，转成前端 camelCase。
export interface AiQuota {
  plan: string
  dailyLimit: number
  usedToday: number
  remaining: number
  lastResetDate: string
}

interface RawAiQuota {
  plan: string
  daily_limit: number
  used_today: number
  remaining: number
  last_reset_date: string
}

// 读取当前登录用户的额度（惰性重置在函数内完成）。供后续 UI 使用。
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
  }
}
