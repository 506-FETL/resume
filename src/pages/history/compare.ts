import type { ResumeSnapshot } from '@/lib/supabase/resume/history'
import type { DiffLine, DiffStatValue } from '@/pages/assistant/components/diff/compute-line-diff'
import { computeLineDiff, diffStat } from '@/pages/assistant/components/diff/compute-line-diff'
import { FIELD_LABEL_MAP, SECTION_LABEL_MAP } from './const'
import { getOrderedSections } from './utils'

export interface FieldDiff {
  key: string
  label: string
  before: string
  after: string
  lines: DiffLine[]
  stat: DiffStatValue
}

export interface SectionDiff {
  sectionKey: string
  sectionLabel: string
  fields: FieldDiff[]
}

function fieldLabel(key: string): string {
  return FIELD_LABEL_MAP[key] ?? key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// 长度为 2、元素均为字符串/空 的数组视为「时间段」（与简历展示逻辑一致）
function isDateRange(value: unknown): value is [string, string] {
  return Array.isArray(value) && value.length === 2
    && value.every(item => typeof item === 'string' || item === null || item === '')
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'string')
}

// 富文本 HTML → 纯文本：块级标签转换行，其余标签去除，便于按行 diff
function htmlToText(html: string): string {
  return html
    .replace(/<\/(p|li|div|h[1-6]|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
}

function isHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

// 把叶子值转成用户可读文本（供逐行 diff 用）
function valueToText(value: unknown): string {
  if (value == null || value === '')
    return ''
  if (typeof value === 'string')
    return isHtml(value) ? htmlToText(value) : value
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  if (isDateRange(value))
    return `${value[0] || '未填'} 至 ${value[1] || '今'}`
  if (Array.isArray(value))
    return value.map(valueToText).filter(Boolean).join('、')
  return JSON.stringify(value)
}

// 只含单个 items 数组的对象 → 直接展开为该数组（跳过「条目」这层标签）
function unwrapItems(value: unknown): unknown {
  if (isRecord(value)) {
    const entries = Object.entries(value)
    if (entries.length === 1 && entries[0][0] === 'items')
      return entries[0][1]
  }
  return value
}

// 叶子：字符串/数字/布尔/时间段/字符串数组/空值
function isLeaf(value: unknown): boolean {
  if (value == null || typeof value !== 'object')
    return true
  return isDateRange(value) || isStringArray(value)
}

// 递归比较，产出「叶子字段级」差异；只保留真正有变化的叶子
function diffValue(before: unknown, after: unknown, path: string[], out: FieldDiff[]) {
  const b = unwrapItems(before)
  const a = unwrapItems(after)
  const shapeSource = a !== undefined && a !== null ? a : b

  // 对象 → 按字段递归
  if (isRecord(shapeSource) && !isLeaf(shapeSource)) {
    const bObj = isRecord(b) ? b : {}
    const aObj = isRecord(a) ? a : {}
    const keys = [...new Set([...Object.keys(bObj), ...Object.keys(aObj)])]
    for (const key of keys)
      diffValue(bObj[key], aObj[key], [...path, fieldLabel(key)], out)
    return
  }

  // 对象数组 → 按「第 N 项」递归
  if (Array.isArray(shapeSource) && !isLeaf(shapeSource)) {
    const bArr = Array.isArray(b) ? b : []
    const aArr = Array.isArray(a) ? a : []
    const len = Math.max(bArr.length, aArr.length)
    for (let i = 0; i < len; i++)
      diffValue(bArr[i], aArr[i], [...path, `第 ${i + 1} 项`], out)
    return
  }

  // 叶子 → 文本比较
  const beforeText = valueToText(before)
  const afterText = valueToText(after)
  if (beforeText === afterText)
    return
  const lines = computeLineDiff(beforeText, afterText)
  out.push({
    key: path.join('/') || 'value',
    label: path.join(' · ') || '内容',
    before: beforeText,
    after: afterText,
    lines,
    stat: diffStat(lines),
  })
}

/** 逐 section 递归比较两个快照，只返回内容有变化的叶子字段。 */
export function diffSnapshots(before: ResumeSnapshot, after: ResumeSnapshot): SectionDiff[] {
  const order = getOrderedSections(after)
  const extra = getOrderedSections(before).filter(section => !order.includes(section))
  const sections = [...order, ...extra]

  const beforeRecord = before as unknown as Record<string, unknown>
  const afterRecord = after as unknown as Record<string, unknown>

  const result: SectionDiff[] = []
  for (const section of sections) {
    const fields: FieldDiff[] = []
    diffValue(beforeRecord[section], afterRecord[section], [], fields)
    if (fields.length > 0)
      result.push({ sectionKey: section, sectionLabel: SECTION_LABEL_MAP[section] ?? section, fields })
  }
  return result
}

/** 有变化的字段总数（用于顶部「共 N 处改动」）。 */
export function totalChangedFields(diffs: SectionDiff[]): number {
  return diffs.reduce((sum, section) => sum + section.fields.length, 0)
}
