// setLeaf 的本地副本，与 src/pages/optimize/utils.ts 保持一致，
// 供集成测试使用（避免 import `@/` 别名 —— node --test 无法解析）。
export function setLeaf(root: any, path: Array<string | number>, value: any) {
  if (!path || path.length === 0) {
    return
  }

  let cur = root
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]
    const nextKey = path[i + 1]
    const normalizedKey = typeof key === 'string' && /^\d+$/.test(key) ? Number(key) : key
    if (cur[normalizedKey] == null) {
      const isNextKeyNumeric = typeof nextKey === 'number' || (typeof nextKey === 'string' && /^\d+$/.test(nextKey))
      cur[normalizedKey] = isNextKeyNumeric ? [] : {}
    }
    cur = cur[normalizedKey]
  }
  const lastKey = path[path.length - 1]
  const normalizedLastKey = typeof lastKey === 'string' && /^\d+$/.test(lastKey) ? Number(lastKey) : lastKey
  cur[normalizedLastKey] = value
}
