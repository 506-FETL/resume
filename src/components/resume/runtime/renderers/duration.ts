/**
 * 经历类 section（工作 / 实习 / 项目 / 教育 / 校园）时间区间 `[start, end]` 的
 * 纯函数工具。全部对 `undefined` / `null` / 非法长度做兜底，避免渲染器在
 * duration 缺失时抛 `Cannot read properties of undefined (reading 'join')`。
 *
 * 背景：历史数据、AI 改写 `setLeaf` 回写、旧快照迁移等路径都可能产出缺 `duration`
 * 的 item。渲染器过滤谓词用 `||` 短路，只要富文本字段（如 eduInfo）非空，item 就
 * 会跳过 `duration.some(...)` 直接进入 `map`，此时 React key 里的 `duration.join('-')`
 * 会因 `duration === undefined` 崩溃。这些 helper 把兜底集中到一处。
 */

/** 区间是否含有任意非空值（等价于旧的 `range.some(Boolean)`，但容忍 undefined）。 */
export function rangeHasValue(range?: readonly (string | null | undefined)[] | null): boolean {
  return Array.isArray(range) && range.some(Boolean)
}

/** 用于 React key 的稳定字符串（等价于旧的 `range.join('-')`，但容忍 undefined）。 */
export function rangeKey(range?: readonly (string | null | undefined)[] | null): string {
  return Array.isArray(range) ? range.map(value => value ?? '').join('-') : ''
}

/**
 * 展示层归一到「年月」：把 `YYYY-MM-DD`（历史数据精确到日）截断为 `YYYY-MM`。
 * 只处理形如 YYYY-MM-DD / YYYY/MM/DD 的完整日期，其余（`至今`、已是 YYYY-MM、空值）原样返回。
 */
function toYearMonth(value: string): string {
  const match = /^(\d{4})[-/](\d{1,2})[-/]\d{1,2}$/.exec(value.trim())
  if (!match) {
    return value
  }
  return `${match[1]}-${match[2].padStart(2, '0')}`
}

/** 展示用区间文案；缺开始时间返回空串，缺结束时间回落「至今」。 */
export function formatRange(range?: readonly (string | null | undefined)[] | null): string {
  if (!range?.[0]) {
    return ''
  }

  const start = toYearMonth(range[0])
  const end = range[1] ? toYearMonth(range[1]) : '至今'
  return `${start} - ${end}`
}
