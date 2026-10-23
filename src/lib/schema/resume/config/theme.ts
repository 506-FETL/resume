import { z } from 'zod'

/**
 * 主题选项
 */
export const themeOptions = [
  { label: '默认', value: 'default' },
  { label: '商务蓝', value: 'blue' },
  { label: '清新绿', value: 'green' },
  { label: '优雅紫', value: 'purple' },
  { label: '活力橙', value: 'orange' },
  { label: '稳重灰', value: 'gray' },
] as const

export const themeEnum = z.enum(['default', 'blue', 'green', 'purple', 'orange', 'gray'])

/**
 * 主题配置 Schema
 */
export const themeConfigSchema = z.object({
  // 当前主题
  theme: themeEnum.default('default'),
})

export type ThemeConfigType = z.infer<typeof themeConfigSchema>

export const DEFAULT_THEME_CONFIG: ThemeConfigType = {
  theme: 'default',
}

/**
 * 主题颜色映射
 */
export interface ThemeColors {
  primaryColor: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  linkColor: string
  linkHoverColor: string
  progressBarBg: string
  progressBarFill: string
  badgeBg: string
}

export const themeColorMap: Record<ThemeConfigType['theme'], ThemeColors> = {
  default: {
    primaryColor: '#111827',
    textPrimary: '#111827',
    textSecondary: '#374151',
    textMuted: '#6b7280',
    linkColor: '#374151',
    linkHoverColor: '#111827',
    progressBarBg: '#e5e7eb',
    progressBarFill: '#374151',
    badgeBg: '#e5e7eb',
  },
  blue: {
    primaryColor: '#1e40af',
    textPrimary: '#111827',
    textSecondary: '#374151',
    textMuted: '#6b7280',
    linkColor: '#2563eb',
    linkHoverColor: '#1d4ed8',
    progressBarBg: '#dbeafe',
    progressBarFill: '#3b82f6',
    badgeBg: '#60a5fa',
  },
  green: {
    primaryColor: '#065f46',
    textPrimary: '#111827',
    textSecondary: '#374151',
    textMuted: '#6b7280',
    linkColor: '#059669',
    linkHoverColor: '#047857',
    progressBarBg: '#d1fae5',
    progressBarFill: '#10b981',
    badgeBg: '#6ee7b7',
  },
  purple: {
    primaryColor: '#5b21b6',
    textPrimary: '#111827',
    textSecondary: '#374151',
    textMuted: '#6b7280',
    linkColor: '#7c3aed',
    linkHoverColor: '#6d28d9',
    progressBarBg: '#ede9fe',
    progressBarFill: '#8b5cf6',
    badgeBg: '#c4b5fd',
  },
  orange: {
    primaryColor: '#c2410c',
    textPrimary: '#111827',
    textSecondary: '#374151',
    textMuted: '#6b7280',
    linkColor: '#ea580c',
    linkHoverColor: '#c2410c',
    progressBarBg: '#fed7aa',
    progressBarFill: '#fb923c',
    badgeBg: '#fdba74',
  },
  gray: {
    primaryColor: '#1f2937',
    textPrimary: '#111827',
    textSecondary: '#374151',
    textMuted: '#6b7280',
    linkColor: '#4b5563',
    linkHoverColor: '#1f2937',
    progressBarBg: '#e5e7eb',
    progressBarFill: '#6b7280',
    badgeBg: '#d1d5db',
  },
}
