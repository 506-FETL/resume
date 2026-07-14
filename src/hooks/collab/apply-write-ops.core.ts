import type { WriteOp } from './write-plan'

/**
 * 写操作执行器的可注入依赖。
 *
 * `updateText` 与 `setLeaf` 从外部注入，使本模块**不 import 任何 `@/` 别名或 Automerge**，
 * 从而可脱离构建工具用 `node --test` 直接测试。真实依赖在 `apply-write-ops.ts` 组装。
 */
export interface WriteDeps {
  updateText: (doc: any, path: (string | number)[], value: string) => void
  setLeaf: (doc: any, path: (string | number)[], value: unknown) => void
}

/** 按完整 Prop 路径解引用文档节点。 */
export function getIn(doc: any, path: (string | number)[]): unknown {
  let cur: any = doc
  for (const key of path) {
    if (cur == null) {
      return undefined
    }
    cur = cur[key]
  }
  return cur
}

/**
 * 把一组字段级写操作应用到 Automerge 文档（在 `docHandle.change` 回调内调用）。
 *
 * - `updateText`：目标当前为字符串 → 字符级合并；否则回退 `setLeaf`（spec §5 兜底）。
 * - `setLeaf`：原子赋值（富文本 / 枚举 / 日期 / number 等）。
 * - `arrayPush` / `arrayDeleteAt`：对父数组代理做尾部结构操作。
 */
export function applyWriteOps(doc: any, ops: WriteOp[], deps: WriteDeps): void {
  for (const op of ops) {
    switch (op.kind) {
      case 'updateText': {
        const current = getIn(doc, op.path)
        if (typeof current === 'string') {
          deps.updateText(doc, op.path, op.value)
        }
        else {
          deps.setLeaf(doc, op.path, op.value)
        }
        break
      }
      case 'setLeaf': {
        deps.setLeaf(doc, op.path, op.value)
        break
      }
      case 'arrayPush': {
        const arr = getIn(doc, op.path) as any
        if (Array.isArray(arr) || typeof arr?.push === 'function') {
          arr.push(op.value)
        }
        break
      }
      case 'arrayDeleteAt': {
        const arr = getIn(doc, op.path) as any
        if (arr == null) {
          break
        }
        if (typeof arr.deleteAt === 'function') {
          arr.deleteAt(op.index)
        }
        else if (typeof arr.splice === 'function') {
          arr.splice(op.index, 1)
        }
        break
      }
    }
  }
}
