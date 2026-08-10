// 简历卡片徽标语义配色
// 语义统一：云端=蓝、本地=灰、生成中=琥珀、生成失败=红、派生=紫
// 与 tracker/const.ts 的 STAGE_STATUS_COLORS 风格一致，附带暗色模式变体。
export type ResumeBadgeTone = 'cloud' | 'local' | 'generating' | 'failed' | 'variant'

export const RESUME_BADGE_COLORS: Record<ResumeBadgeTone, string> = {
  cloud: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300',
  local: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300',
  generating: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
  failed: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
  variant: 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-300',
}
