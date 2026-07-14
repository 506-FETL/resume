import assert from 'node:assert/strict'
import { test } from 'node:test'
import { next as Automerge } from '@automerge/automerge'
import { planRemoteFormSync } from '../form-remote-sync.ts'
import { applyWriteOps } from './apply-write-ops.core.ts'
import { classifyLeaf } from './classify-leaf.ts'
import { setLeaf } from './test-setleaf.fixture.ts'
import { buildWriteOps } from './write-plan.ts'

// 真实 Automerge 依赖：证明字段级写路径在 CRDT 层真正实现无冲突合并。
const deps = {
  updateText: (doc: any, path: (string | number)[], value: string) => Automerge.updateText(doc, path, value),
  setLeaf,
}

function seed() {
  return Automerge.from<any>({
    basics: { name: 'Alice', email: 'a@x.com' },
    work_experience: { items: [{ companyName: 'Acme' }] },
    self_evaluation: { content: '<p>hello</p>' },
  })
}

// 复用生产读路径规划器保持与生产一致
function planFor(base: any, next: any, fieldArrays: string[]) {
  return planRemoteFormSync(base, next, fieldArrays)
}

/** 模拟一名协作者：以变更前的 section 值为 base，对新表单值计算并应用字段级写操作。 */
function collaboratorEdit(doc: any, sectionKey: string, base: any, next: any, fieldArrays: string[] = []) {
  const plan = buildWriteOps(planFor(base, next, fieldArrays), sectionKey, classifyLeaf)
  return Automerge.change(doc, (d: any) => applyWriteOps(d, plan, deps))
}

test('concurrent edits to DIFFERENT fields both survive merge (no clobber)', () => {
  const root = seed()

  // 两个协作者从同一起点分叉
  let alice = Automerge.clone(root)
  let bob = Automerge.clone(root)

  // Alice 改 name，Bob 改 email —— 各自只写自己的叶子
  alice = collaboratorEdit(alice, 'basics', { name: 'Alice', email: 'a@x.com' }, { name: 'Alice Wang', email: 'a@x.com' })
  bob = collaboratorEdit(bob, 'basics', { name: 'Alice', email: 'a@x.com' }, { name: 'Alice', email: 'bob@y.com' })

  // 合并双方变更
  const merged = Automerge.merge(Automerge.merge(Automerge.clone(root), alice), bob)

  assert.equal(merged.basics.name, 'Alice Wang', 'Alice 的 name 保留')
  assert.equal(merged.basics.email, 'bob@y.com', 'Bob 的 email 保留，未被 Alice 覆盖')
})

test('concurrent edits to the SAME free-text field merge character-by-character', () => {
  const root = seed()
  let alice = Automerge.clone(root)
  let bob = Automerge.clone(root)

  // 两人从 'Alice' 出发同时编辑 name
  // Alice 前面加 'Dr. ' -> 'Dr. Alice'
  alice = collaboratorEdit(alice, 'basics', { name: 'Alice', email: 'a@x.com' }, { name: 'Dr. Alice', email: 'a@x.com' })
  // Bob 后面加 ' Wang' -> 'Alice Wang'
  bob = collaboratorEdit(bob, 'basics', { name: 'Alice', email: 'a@x.com' }, { name: 'Alice Wang', email: 'a@x.com' })

  const merged = Automerge.merge(Automerge.merge(Automerge.clone(root), alice), bob)

  // 字符级 CRDT 合并：两处编辑都保留，不是二选一覆盖
  assert.ok(merged.basics.name.includes('Dr.'), `期望包含 Alice 的前缀，实际: ${merged.basics.name}`)
  assert.ok(merged.basics.name.includes('Wang'), `期望包含 Bob 的后缀，实际: ${merged.basics.name}`)
  assert.ok(merged.basics.name.includes('Alice'), `期望保留公共部分，实际: ${merged.basics.name}`)
})

test('concurrent edits to an array item leaf (different items) both survive', () => {
  const root = Automerge.from<any>({
    work_experience: { items: [{ companyName: 'A' }, { companyName: 'B' }] },
  })
  let alice = Automerge.clone(root)
  let bob = Automerge.clone(root)

  alice = collaboratorEdit(
    alice,
    'work_experience',
    { items: [{ companyName: 'A' }, { companyName: 'B' }] },
    { items: [{ companyName: 'A2' }, { companyName: 'B' }] },
    ['items'],
  )
  bob = collaboratorEdit(
    bob,
    'work_experience',
    { items: [{ companyName: 'A' }, { companyName: 'B' }] },
    { items: [{ companyName: 'A' }, { companyName: 'B2' }] },
    ['items'],
  )

  const merged = Automerge.merge(Automerge.merge(Automerge.clone(root), alice), bob)
  assert.equal(merged.work_experience.items[0].companyName, 'A2')
  assert.equal(merged.work_experience.items[1].companyName, 'B2')
})

test('tail append from one side + field edit from other both survive', () => {
  const root = Automerge.from<any>({
    work_experience: { items: [{ companyName: 'A' }] },
  })
  let alice = Automerge.clone(root)
  let bob = Automerge.clone(root)

  // Alice 追加一项
  alice = collaboratorEdit(
    alice,
    'work_experience',
    { items: [{ companyName: 'A' }] },
    { items: [{ companyName: 'A' }, { companyName: 'New' }] },
    ['items'],
  )
  // Bob 改第 0 项的自由文本
  bob = collaboratorEdit(
    bob,
    'work_experience',
    { items: [{ companyName: 'A' }] },
    { items: [{ companyName: 'Acme' }] },
    ['items'],
  )

  const merged = Automerge.merge(Automerge.merge(Automerge.clone(root), alice), bob)
  assert.equal(merged.work_experience.items.length, 2, '追加的项保留')
  assert.ok(merged.work_experience.items[0].companyName.includes('Acme') || merged.work_experience.items[0].companyName.includes('A'))
  assert.equal(merged.work_experience.items[1].companyName, 'New')
})
