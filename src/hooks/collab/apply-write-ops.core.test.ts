import type { WriteDeps } from './apply-write-ops.core.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyWriteOps, getIn } from './apply-write-ops.core.ts'

function recordingDeps() {
  const calls: Array<{ fn: string, path: (string | number)[], value?: unknown }> = []
  const deps: WriteDeps = {
    updateText: (_doc, path, value) => { calls.push({ fn: 'updateText', path, value }) },
    setLeaf: (doc, path, value) => {
      calls.push({ fn: 'setLeaf', path, value })
      // 真正写入，方便断言最终结构
      let cur: any = doc
      for (let i = 0; i < path.length - 1; i += 1) cur = cur[path[i]]
      cur[path[path.length - 1]] = value
    },
  }
  return { calls, deps }
}

test('getIn resolves full path with section key and numeric index', () => {
  const doc = { work_experience: { items: [{ companyName: 'A' }] } }
  assert.equal(getIn(doc, ['work_experience', 'items', 0, 'companyName']), 'A')
  assert.deepEqual(getIn(doc, ['work_experience', 'items']), [{ companyName: 'A' }])
})

test('updateText op on string target calls deps.updateText', () => {
  const doc = { basics: { name: 'ab' } }
  const { calls, deps } = recordingDeps()
  applyWriteOps(doc, [{ kind: 'updateText', path: ['basics', 'name'], value: 'abc' }], deps)
  assert.deepEqual(calls, [{ fn: 'updateText', path: ['basics', 'name'], value: 'abc' }])
})

test('updateText op on non-string target falls back to setLeaf', () => {
  const doc: any = { basics: { name: null } }
  const { calls, deps } = recordingDeps()
  applyWriteOps(doc, [{ kind: 'updateText', path: ['basics', 'name'], value: 'abc' }], deps)
  assert.equal(calls[0].fn, 'setLeaf')
  assert.equal(doc.basics.name, 'abc')
})

test('setLeaf op calls deps.setLeaf', () => {
  const doc: any = { job_intent: { dateEntry: '不填' } }
  const { calls, deps } = recordingDeps()
  applyWriteOps(doc, [{ kind: 'setLeaf', path: ['job_intent', 'dateEntry'], value: '随时到岗' }], deps)
  assert.equal(calls[0].fn, 'setLeaf')
  assert.equal(doc.job_intent.dateEntry, '随时到岗')
})

test('arrayPush op appends to parent array', () => {
  const doc: any = { work_experience: { items: [{ companyName: 'A' }] } }
  const { deps } = recordingDeps()
  applyWriteOps(doc, [{ kind: 'arrayPush', path: ['work_experience', 'items'], value: { companyName: 'B' } }], deps)
  assert.deepEqual(doc.work_experience.items, [{ companyName: 'A' }, { companyName: 'B' }])
})

test('arrayDeleteAt op removes at index (uses deleteAt when present, else splice)', () => {
  // 模拟 Automerge 数组代理：带 deleteAt
  const items: any = [{ n: 'A' }, { n: 'B' }]
  items.deleteAt = (i: number) => { items.splice(i, 1) }
  const doc: any = { work_experience: { items } }
  const { deps } = recordingDeps()
  applyWriteOps(doc, [{ kind: 'arrayDeleteAt', path: ['work_experience', 'items'], index: 1 }], deps)
  assert.deepEqual([...doc.work_experience.items], [{ n: 'A' }])
})

test('multiple ops applied in order', () => {
  const doc: any = { basics: { name: 'ab', email: 'x' } }
  const { calls, deps } = recordingDeps()
  applyWriteOps(doc, [
    { kind: 'updateText', path: ['basics', 'name'], value: 'abc' },
    { kind: 'setLeaf', path: ['basics', 'email'], value: 'y' },
  ], deps)
  assert.equal(calls.length, 2)
  assert.equal(doc.basics.email, 'y')
})
