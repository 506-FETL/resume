import type { ValueType } from './types'
import { FIELD_LABEL_MAP, PREVIEW_RENDERER_MAP } from './const'

export function calculateRating(score: number) {
  if (score >= 90)
    return 'text-green-600'
  if (score >= 80)
    return 'text-emerald-600'
  if (score >= 60)
    return 'text-yellow-600'
  if (score >= 40)
    return 'text-orange-600'

  return 'text-red-600'
}

export function calculateReadabilityRating(score: number) {
  if (score >= 9)
    return 'text-green-600'
  if (score >= 7)
    return 'text-emerald-600'
  if (score >= 5)
    return 'text-yellow-600'
  if (score >= 3)
    return 'text-orange-600'
  return 'text-red-600'
}

export function getFieldLabel(key: string): string {
  return FIELD_LABEL_MAP[key] || key
}

export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined)
    return true
  if (typeof value === 'string' && value.trim() === '')
    return true
  if (Array.isArray(value) && value.length === 0)
    return true
  if (Array.isArray(value) && value.every(v => v === '' || v === null))
    return true
  return false
}

export function detectValueType(value: unknown): 'skill_list' | 'skill_item' | 'certificate_list' | 'date_range' | 'string_array' | 'object_array' | 'object' | 'string' | 'empty' {
  if (isEmptyValue(value))
    return 'empty'

  // 检测日期范围（长度为2的字符串数组）
  if (Array.isArray(value) && value.length === 2 && value.every(v => typeof v === 'string' || v === null || v === '')) {
    return 'date_range'
  }

  // 检测技能列表
  if (Array.isArray(value) && value.length > 0 && value[0] && typeof value[0] === 'object') {
    const first = value[0] as Record<string, unknown>
    if ('label' in first && 'proficiencyLevel' in first) {
      return 'skill_list'
    }
    if ('name' in first && Object.keys(first).length === 1) {
      return 'certificate_list'
    }
    return 'object_array'
  }

  // 检测技能项
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    if ('label' in obj && 'proficiencyLevel' in obj) {
      return 'skill_item'
    }
    return 'object'
  }

  // 检测字符串数组
  if (Array.isArray(value) && value.every(v => typeof v === 'string')) {
    return 'string_array'
  }

  return 'string'
}

export function renderValue(value: unknown): string {
  if (value === null || value === undefined)
    return '-'
  if (typeof value === 'boolean')
    return value ? '是' : '否'
  if (typeof value === 'number')
    return value.toString()
  if (typeof value === 'string')
    return value || '-'
  if (Array.isArray(value))
    return value.join(', ') || '-'
  return JSON.stringify(value)
}

// 渲染预览值
export function renderPreview(value: unknown, valueType: ValueType): string {
  if (isEmptyValue(value))
    return '（空）'

  if (valueType === 'html_string') {
    const text = (value as string).replace(/<[^>]*>/g, ' ').trim()
    return text.slice(0, 150) + (text.length > 150 ? '...' : '')
  }

  const detectedType = detectValueType(value)
  const renderer = PREVIEW_RENDERER_MAP[detectedType]

  if (renderer) {
    return renderer(value)
  }

  return String(value)
}

export const callAll = <T>(fns: Array<(...args: T[]) => void | undefined>) => (...args: T[]) => fns.forEach(fn => fn?.(...args))
