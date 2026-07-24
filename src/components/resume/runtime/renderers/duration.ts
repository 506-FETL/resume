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

/** 展示用区间文案；缺开始时间返回空串，缺结束时间回落「至今」。 */
export function formatRange(range?: readonly (string | null | undefined)[] | null): string {
  if (!range?.[0]) {
    return ''
  }

  return `${range[0]} - ${range[1] || '至今'}`
}
