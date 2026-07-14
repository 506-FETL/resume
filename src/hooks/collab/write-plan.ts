import type { RemoteFormSyncPlan } from '../form-remote-sync'
import type { LeafClass } from './classify-leaf'

/**
 * 单条「文档写操作描述」——纯数据，不触碰 Automerge。
 * 由执行器 `applyWriteOps` 翻译为实际的 `updateText` / `setLeaf` / `push` / `deleteAt`。
 *
 * `path` 为**含 sectionKey 的完整 Prop 路径**，数组索引段为 number。
 */
export type WriteOp
  = | { kind: 'updateText', path: (string | number)[], value: string }
    | { kind: 'setLeaf', path: (string | number)[], value: unknown }
    | { kind: 'arrayPush', path: (string | number)[], value: unknown }
    | { kind: 'arrayDeleteAt', path: (string | number)[], index: number }

export type ClassifyLeaf = (sectionKey: string, relativePath: string) => LeafClass

/**
 * 把某个 section 的读路径 diff plan 翻译成字段级写操作。
 *
 * `planRemoteFormSync` 只产出以 `.` 连接的路径（无方括号语法），
 * 故直接 `split('.')` 拆段，对纯数字段转 number，并在最前拼上 `sectionKey`。
 *
 * 合并策略：
 * - `freeText` 且新值为字符串 -> `updateText`（字符级合并）。
 * - 其余（`rich` / `atomic` / 非字符串）-> `setLeaf`（LWW）。
 * - 字段数组 `append` -> `arrayPush`；`remove` -> `arrayDeleteAt`（均为尾部操作）。
 */
export function buildWriteOps(
  plan: RemoteFormSyncPlan,
  sectionKey: string,
  classify: ClassifyLeaf,
): WriteOp[] {
  const ops: WriteOp[] = []

  for (const update of plan.fieldUpdates) {
    const fullPath = toFullPath(sectionKey, update.path)
    const isFreeText = classify(sectionKey, update.path) === 'freeText'

    if (isFreeText && typeof update.value === 'string') {
      ops.push({ kind: 'updateText', path: fullPath, value: update.value })
    }
    else {
      ops.push({ kind: 'setLeaf', path: fullPath, value: update.value })
    }
  }

  for (const operation of plan.fieldArrayOperations) {
    const fullPath = toFullPath(sectionKey, operation.path)

    if (operation.type === 'append') {
      ops.push({ kind: 'arrayPush', path: fullPath, value: operation.value })
    }
    else {
      ops.push({ kind: 'arrayDeleteAt', path: fullPath, index: operation.index })
    }
  }

  return ops
}

/**
 * `sectionKey` + 相对路径 -> 完整 Prop 路径，数组索引段规范化为 number。
 * 例：`('work_experience', 'items.0.companyName')` -> `['work_experience','items',0,'companyName']`
 */
function toFullPath(sectionKey: string, relativePath: string): (string | number)[] {
  if (relativePath === '') {
    return [sectionKey]
  }

  const segments = relativePath.split('.').map(seg => (/^\d+$/.test(seg) ? Number(seg) : seg))
  return [sectionKey, ...segments]
}
