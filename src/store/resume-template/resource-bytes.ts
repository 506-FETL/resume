import { resourceBytes } from '@/lib/resume-template/source/cache'

const sizes = new WeakMap<object, number>()

// 页面 store 替换整条资源；同一对象在目录追加、筛选或示例切换时仍有相同大小。
export function cachedResourceBytes(value: object): number {
  const cached = sizes.get(value)

  if (cached !== undefined) return cached

  const bytes = resourceBytes(value)

  sizes.set(value, bytes)

  return bytes
}
