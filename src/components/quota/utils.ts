// 额度展示的共享工具：告警等级判定 + 恢复时间友好文案。

export type QuotaTone = 'normal' | 'low' | 'empty'

// 低额度阈值：剩余 ≤ LOW_THRESHOLD 时进入告警态
export const LOW_THRESHOLD = 3

// 根据剩余次数判定告警等级
export function getQuotaTone(remaining: number): QuotaTone {
  if (remaining <= 0)
    return 'empty'
  if (remaining <= LOW_THRESHOLD)
    return 'low'
  return 'normal'
}

// 已用占比（0-100），用于 Progress。dailyLimit 为 0 时返回 0。
export function getUsedPercent(usedToday: number, dailyLimit: number): number {
  if (dailyLimit <= 0)
    return 0
  return Math.min(100, Math.round((usedToday / dailyLimit) * 100))
}

// ============ 角色分层视觉 ============
export type PlanTier = 'root' | 'max' | 'pro' | 'free'

export function normalizePlan(plan?: string | null): PlanTier {
  switch ((plan ?? '').toLowerCase()) {
    case 'root':
      return 'root'
    case 'max':
      return 'max'
    case 'pro':
      return 'pro'
    default:
      return 'free'
  }
}

export interface PlanBadge {
  label: string
  // pill 的完整 className（含背景/文字/描边/光泽），套在统一的 pill 基础样式之上
  className: string
}

/**
 * 四档角色标签样式：
 * - root（管理员）：轻奢低调有内涵——深墨底 + 细金描边 + 柔金字
 * - max：高端大气上档次——暖金→橙→玫的渐变 + 白字 + 光泽
 * - pro：比 free 精致——紫罗兰淡彩
 * - free：最普通——中性次要色
 */
export function getPlanBadge(plan?: string | null): PlanBadge {
  switch (normalizePlan(plan)) {
    case 'root':
      return {
        label: '管理员',
        className:
          'border border-amber-300/40 bg-neutral-900 text-amber-100 shadow-sm dark:bg-neutral-950 dark:text-amber-200/90',
      }
    case 'max':
      return {
        label: 'MAX',
        className:
          'border-0 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 text-white shadow-sm',
      }
    case 'pro':
      return {
        label: 'PRO',
        className:
          'border border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300',
      }
    default:
      return {
        label: '免费版',
        className: 'border border-border bg-secondary text-secondary-foreground',
      }
  }
}

/**
 * 把恢复时间（ISO）转成本地友好文案。
 * - 今日：`今日 HH:mm 恢复`
 * - 明日：`明日 HH:mm 恢复`
 * - 更远：`MM/DD HH:mm 恢复`
 * - 无 resetAt：兜底 `每日 0 点重置`
 */
export function formatResetTime(resetAt?: string | null): string {
  if (!resetAt)
    return '每日 0 点重置'
  const target = new Date(resetAt)
  if (Number.isNaN(target.getTime()))
    return '每日 0 点重置'

  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const dayDiff = Math.round((startOfDay(target) - startOfDay(now)) / 86_400_000)

  const time = target.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (dayDiff <= 0)
    return `今日 ${time} 恢复`
  if (dayDiff === 1)
    return `明日 ${time} 恢复`
  const date = target.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
  return `${date} ${time} 恢复`
}
