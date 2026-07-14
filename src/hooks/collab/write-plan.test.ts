import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classifyLeaf } from './classify-leaf.ts'
import { planRemoteFormSync } from '../form-remote-sync.ts'
import { buildWriteOps } from './write-plan.ts'

test('free text leaf -> updateText with full path', () => {
  const plan = planRemoteFormSync({ name: 'ab' }, { name: 'abc' })
  const ops = buildWriteOps(plan, 'basics', classifyLeaf)
  assert.deepEqual(ops, [{ kind: 'updateText', path: ['basics', 'name'], value: 'abc' }])
})

test('enum leaf -> setLeaf (not updateText)', () => {
  const plan = planRemoteFormSync({ dateEntry: '不填' }, { dateEntry: '随时到岗' })
  const ops = buildWriteOps(plan, 'job_intent', classifyLeaf)
  assert.deepEqual(ops, [{ kind: 'setLeaf', path: ['job_intent', 'dateEntry'], value: '随时到岗' }])
})

test('number leaf -> setLeaf', () => {
  const plan = planRemoteFormSync({ expectedSalary: 10 }, { expectedSalary: 20 })
  const ops = buildWriteOps(plan, 'job_intent', classifyLeaf)
  assert.deepEqual(ops, [{ kind: 'setLeaf', path: ['job_intent', 'expectedSalary'], value: 20 }])
})

test('rich text leaf -> setLeaf', () => {
  const plan = planRemoteFormSync({ content: '<p>a</p>' }, { content: '<p>ab</p>' })
  const ops = buildWriteOps(plan, 'self_evaluation', classifyLeaf)
  assert.deepEqual(ops, [{ kind: 'setLeaf', path: ['self_evaluation', 'content'], value: '<p>ab</p>' }])
})

test('array grow -> arrayPush', () => {
  const base = { items: [{ companyName: 'A' }] }
  const next = { items: [{ companyName: 'A' }, { companyName: 'B' }] }
  const ops = buildWriteOps(planRemoteFormSync(base, next, ['items']), 'work_experience', classifyLeaf)
  assert.deepEqual(ops, [{ kind: 'arrayPush', path: ['work_experience', 'items'], value: { companyName: 'B' } }])
})

test('array item leaf edit -> updateText with numeric index', () => {
  const edit = buildWriteOps(
    planRemoteFormSync({ items: [{ companyName: 'A' }] }, { items: [{ companyName: 'AB' }] }, ['items']),
    'work_experience',
    classifyLeaf,
  )
  assert.deepEqual(edit, [{ kind: 'updateText', path: ['work_experience', 'items', 0, 'companyName'], value: 'AB' }])
})

test('array shrink at tail -> arrayDeleteAt', () => {
  const ops = buildWriteOps(
    planRemoteFormSync({ items: [{ companyName: 'A' }, { companyName: 'B' }] }, { items: [{ companyName: 'A' }] }, ['items']),
    'work_experience',
    classifyLeaf,
  )
  assert.deepEqual(ops, [{ kind: 'arrayDeleteAt', path: ['work_experience', 'items'], index: 1 }])
})

test('atomic date tuple element -> setLeaf with numeric index', () => {
  const ops = buildWriteOps(
    planRemoteFormSync(
      { items: [{ workDuration: ['2020', '2021'] }] },
      { items: [{ workDuration: ['2020', '2022'] }] },
      ['items'],
    ),
    'work_experience',
    classifyLeaf,
  )
  assert.deepEqual(ops, [{ kind: 'setLeaf', path: ['work_experience', 'items', 0, 'workDuration', 1], value: '2022' }])
})

test('no change -> no ops', () => {
  assert.deepEqual(buildWriteOps(planRemoteFormSync({ name: 'a' }, { name: 'a' }), 'basics', classifyLeaf), [])
})
