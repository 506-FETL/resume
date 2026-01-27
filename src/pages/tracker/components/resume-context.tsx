import { createContext, use } from 'react'

/**
 * 简历主题配置
 */
export interface ResumeTheme {
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

/**
 * 简历间距配置
 */
export interface ResumeSpacing {
  pagePadding: string
  sectionMargin: string
  sectionTitleMargin: string
  itemSpacing: string
  paragraphSpacing: string
  lineHeight: number
  proseLineHeight: number
}

/**
 * 简历字体配置
 */
export interface ResumeFont {
  fontFamily: string
  nameSize: string
  jobIntentSize: string
  sectionTitleSize: string
  contentSize: string
  smallSize: string
  boldWeight: number
  mediumWeight: number
  normalWeight: number
}

/**
 * 简历上下文类型
 */
export interface ResumeContextType {
  theme: ResumeTheme
  spacing: ResumeSpacing
  font: ResumeFont
}

// 创建 Context
const ResumeContext = createContext<ResumeContextType | null>(null)

/**
 * 使用简历上下文的 Hook
 */
export function useResumeContext() {
  const context = use(ResumeContext)
  if (!context) {
    throw new Error('useResumeContext 必须在 ResumeWrapper 内部使用')
  }
  return context
}

/**
 * 预设主题
 */
export const themes = {
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
} as const

/**
 * 默认配置
 */
export const defaultSpacing: ResumeSpacing = {
  pagePadding: '1rem',
  sectionMargin: '1rem',
  sectionTitleMargin: '0.75rem',
  itemSpacing: '0.55rem',
  paragraphSpacing: '0.25rem',
  lineHeight: 1.6,
  proseLineHeight: 1.6,
}

export const defaultFont: ResumeFont = {
  fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Microsoft YaHei', sans-serif`,
  nameSize: '1.875rem',
  jobIntentSize: '1rem',
  sectionTitleSize: '1rem',
  contentSize: '0.875rem',
  smallSize: '0.75rem',
  boldWeight: 700,
  mediumWeight: 600,
  normalWeight: 400,
}
