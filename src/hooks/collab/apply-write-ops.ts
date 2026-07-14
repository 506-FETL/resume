import type { WriteDeps } from './apply-write-ops.core'
import type { WriteOp } from './write-plan'
import { next as Automerge } from '@automerge/automerge'
import { setLeaf } from '@/pages/optimize/utils'
import { applyWriteOps } from './apply-write-ops.core'

/**
 * 组装真实写依赖：Automerge `next.updateText`（字符级合并）+ 项目 `setLeaf`（原子赋值）。
 *
 * 本模块 import `@/` 别名与 Automerge，故不参与 `node --test` 纯函数测试；
 * 分发逻辑由 `apply-write-ops.core.ts` 覆盖。
 */
const defaultDeps: WriteDeps = {
  updateText: (doc, path, value) => Automerge.updateText(doc, path, value),
  setLeaf,
}

/** 在 `docHandle.change` 回调内，用真实依赖应用字段级写操作。 */
export function applyWriteOpsDefault(doc: any, ops: WriteOp[]): void {
  applyWriteOps(doc, ops, defaultDeps)
}
