import { fieldLabel, HIDDEN_DIFF_FIELDS } from './field-labels.ts'

export interface FieldChange {
  path: string // 展示用路径，如 "工作经历 #1 · 公司名称"
  label: string
  kind: 'added' | 'removed' | 'changed'
  before: string
  after: string
}

const EMPTY = '（空）'

// 归一化值为可读字符串（对象/数组/富文本简化）
function toDisplay(value: unknown): string {
  if (value == null || value === '')
    return EMPTY
  if (typeof value === 'string') {
    // 去 HTML 标签，避免富文本原样展示
    const text = value.replace(/<[^>]+>/g, '').trim()
    return text || EMPTY
  }
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  if (Array.isArray(value)) {
    if (value.every(v => typeof v === 'string'))
      return value.filter(Boolean).join(' ~ ') || EMPTY
    return `${value.length} 项`
  }
  return JSON.stringify(value)
}

function diffScalar(label: string, path: string, before: unknown, after: unknown, out: FieldChange[]): void {
  const b = toDisplay(before)
  const a = toDisplay(after)
  if (b === a)
    return
  out.push({
    path,
    label,
    kind: b === EMPTY ? 'added' : a === EMPTY ? 'removed' : 'changed',
    before: b,
    after: a,
  })
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * 对比一个对象的标量字段（跳过技术字段与对象/对象数组，字符串数组作为整体对比）
 */
function diffObjectScalars(sectionLabel: string, prefix: string, before: unknown, after: unknown, out: FieldChange[]): void {
  const b = isRecord(before) ? before : {}
  const a = isRecord(after) ? after : {}
  const keys = new Set([...Object.keys(b), ...Object.keys(a)])
  for (const key of keys) {
    if (HIDDEN_DIFF_FIELDS.has(key))
      continue
    const bVal = b[key]
    const aVal = a[key]
    // 跳过嵌套对象
    if (isRecord(bVal) || isRecord(aVal))
      continue
    // 对象数组交给 computeFieldDiff 的标签类分支处理；字符串数组（如 duration）直接当标量对比
    if (Array.isArray(bVal) || Array.isArray(aVal)) {
      const bArr = Array.isArray(bVal) ? bVal : []
      const aArr = Array.isArray(aVal) ? aVal : []
      const allStrings
        = bArr.every((v: unknown) => typeof v === 'string')
          && aArr.every((v: unknown) => typeof v === 'string')
      if (!allStrings)
        continue // 非字符串数组在标签类分支处理
      // 字符串数组落入下方 diffScalar，toDisplay 会 join(' ~ ')
    }
    const label = fieldLabel(key)
    diffScalar(label, prefix ? `${prefix} · ${label}` : `${sectionLabel} · ${label}`, bVal, aVal, out)
  }
}

/** 对比 items 型集合（按 entryId 配对），同级标量字段也一并对比 */
function diffItems(sectionLabel: string, before: unknown, after: unknown, out: FieldChange[]): void {
  const bItems = (isRecord(before) && Array.isArray(before.items) ? before.items : []) as Array<Record<string, unknown>>
  const aItems = (isRecord(after) && Array.isArray(after.items) ? after.items : []) as Array<Record<string, unknown>>
  const bMap = new Map(bItems.map(it => [String(it.entryId), it]))
  const aMap = new Map(aItems.map(it => [String(it.entryId), it]))
  const allIds = [...new Set([...bMap.keys(), ...aMap.keys()])]
  for (const id of allIds) {
    const aIdx = aItems.findIndex(it => String(it.entryId) === id)
    const ordinal = aIdx >= 0 ? aIdx + 1 : bItems.findIndex(it => String(it.entryId) === id) + 1
    diffObjectScalars(sectionLabel, `${sectionLabel} #${ordinal}`, bMap.get(id), aMap.get(id), out)
  }
}

/**
 * 顶层入口：根据数据结构选择对比策略：
 *   - {items:[...]} 经历类：按 entryId 配对逐条对比
 *   - 含数组字段（skills/certificates/hobbies）的标签类：description 标量 + 数组按 entryId 配对
 *   - 单例对象（basics/job_intent/self_evaluation）：直接对比标量字段
 */
export function computeFieldDiff(sectionLabel: string, before: unknown, after: unknown): FieldChange[] {
  const out: FieldChange[] = []
  const hasItems
    = (isRecord(before) && Array.isArray(before.items))
      || (isRecord(after) && Array.isArray(after.items))

  if (hasItems) {
    // 经历类：items 按 entryId 配对
    diffItems(sectionLabel, before, after, out)
    // items 同级的标量字段（若存在也一并对比）
    diffObjectScalars(sectionLabel, '', before, after, out)
  }
  else {
    // 单例 / 标签类：先对比标量字段（含字符串数组）
    diffObjectScalars(sectionLabel, '', before, after, out)
    // 标签类的对象数组字段：按 entryId 配对逐条对比
    const b = isRecord(before) ? before : {}
    const a = isRecord(after) ? after : {}
    for (const key of new Set([...Object.keys(b), ...Object.keys(a)])) {
      if (HIDDEN_DIFF_FIELDS.has(key))
        continue
      const bVal = b[key]
      const aVal = a[key]
      if (!Array.isArray(bVal) && !Array.isArray(aVal))
        continue
      const bArr = (Array.isArray(bVal) ? bVal : []) as Array<Record<string, unknown>>
      const aArr = (Array.isArray(aVal) ? aVal : []) as Array<Record<string, unknown>>
      // 字符串数组已在 diffObjectScalars 处理，跳过
      if (bArr.every(x => typeof x === 'string') && aArr.every(x => typeof x === 'string'))
        continue
      const bMap = new Map(bArr.map(it => [String(it.entryId), it]))
      const aMap = new Map(aArr.map(it => [String(it.entryId), it]))
      const arrayLabel = fieldLabel(key)
      const allIds = [...new Set([...bMap.keys(), ...aMap.keys()])]
      for (const id of allIds) {
        const aIdx = aArr.findIndex(it => String(it.entryId) === id)
        const ordinal = aIdx >= 0 ? aIdx + 1 : bArr.findIndex(it => String(it.entryId) === id) + 1
        diffObjectScalars(arrayLabel, `${arrayLabel} #${ordinal}`, bMap.get(id), aMap.get(id), out)
      }
    }
  }
  return out
}
