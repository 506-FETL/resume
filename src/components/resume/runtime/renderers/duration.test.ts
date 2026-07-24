import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatRange, rangeHasValue, rangeKey } from './duration.ts'

// 复现 bug：教育经历 / 校园经历等富文本填写时报
// `Cannot read properties of undefined (reading 'join')`。
// 根因是渲染器过滤谓词 `||` 短路后，item 的 duration 仍可能为 undefined，
// 随后 React key 里 `item.duration.join('-')` 抛错。下列断言保证纯函数不再抛。

test('rangeKey tolerates undefined / null / partial ranges', () => {
  assert.equal(rangeKey(undefined), '')
  assert.equal(rangeKey(null), '')
  assert.equal(rangeKey([]), '')
  assert.equal(rangeKey(['2020-01', '2024-09']), '2020-01-2024-09')
  assert.equal(rangeKey(['2020-01', '']), '2020-01-')
  // 含 null/undefined 的元素不应抛错
  assert.equal(rangeKey([null, undefined] as unknown as string[]), '-')
})

test('rangeHasValue tolerates undefined and mirrors some(Boolean)', () => {
  assert.equal(rangeHasValue(undefined), false)
  assert.equal(rangeHasValue(null), false)
  assert.equal(rangeHasValue([]), false)
  assert.equal(rangeHasValue(['', '']), false)
  assert.equal(rangeHasValue(['2020-01', '']), true)
  assert.equal(rangeHasValue(['', '至今']), true)
})

test('formatRange stays defensive against undefined', () => {
  assert.equal(formatRange(undefined), '')
  assert.equal(formatRange([]), '')
  assert.equal(formatRange(['2020-01']), '2020-01 - 至今')
  assert.equal(formatRange(['2020-01', '2024-09']), '2020-01 - 2024-09')
})
