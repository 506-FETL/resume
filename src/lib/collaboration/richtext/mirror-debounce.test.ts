import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { createDebouncedMirror } from './mirror-debounce.ts'

test('debounces and coalesces to last value', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  const seen: string[] = []
  const m = createDebouncedMirror((v: string) => seen.push(v), 300)
  m.run('a')
  m.run('b')
  m.run('c')
  assert.deepEqual(seen, [])
  mock.timers.tick(300)
  assert.deepEqual(seen, ['c'])
  mock.timers.reset()
})

test('flush runs pending immediately with last value', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  const seen: string[] = []
  const m = createDebouncedMirror((v: string) => seen.push(v), 300)
  m.run('x')
  m.flush()
  assert.deepEqual(seen, ['x'])
  mock.timers.tick(300) // 不应再次触发
  assert.deepEqual(seen, ['x'])
  mock.timers.reset()
})

test('flush with no pending is a no-op', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  const seen: string[] = []
  const m = createDebouncedMirror((v: string) => seen.push(v), 300)
  m.flush()
  assert.deepEqual(seen, [])
  mock.timers.reset()
})

test('cancel discards pending', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  const seen: string[] = []
  const m = createDebouncedMirror((v: string) => seen.push(v), 300)
  m.run('y')
  m.cancel()
  mock.timers.tick(300)
  assert.deepEqual(seen, [])
  mock.timers.reset()
})

test('separate debounce windows each fire', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  const seen: string[] = []
  const m = createDebouncedMirror((v: string) => seen.push(v), 300)
  m.run('1')
  mock.timers.tick(300)
  m.run('2')
  mock.timers.tick(300)
  assert.deepEqual(seen, ['1', '2'])
  mock.timers.reset()
})
