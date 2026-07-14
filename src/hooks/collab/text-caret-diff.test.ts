import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mapCaretByDiff } from './text-caret-diff.ts'

test('no change keeps caret', () => {
  assert.equal(mapCaretByDiff('hello', 'hello', 3), 3)
})

test('remote insert before caret shifts caret right', () => {
  // 'hello' -> 'helXlo' inserts 'X' at index 3; local caret at 5 ('hello|') -> 6
  assert.equal(mapCaretByDiff('hello', 'helXlo', 5), 6)
})

test('remote insert after caret keeps caret', () => {
  assert.equal(mapCaretByDiff('hello', 'helloX', 2), 2)
})

test('remote delete before caret shifts caret left', () => {
  // 'hello' -> 'helo' removes one 'l'; caret at 5 -> 4
  assert.equal(mapCaretByDiff('hello', 'helo', 5), 4)
})

test('pure prepend shifts caret', () => {
  // 'bar' -> 'foobar' prepends 'foo' (len 3); caret at 1 -> 4
  assert.equal(mapCaretByDiff('bar', 'foobar', 1), 4)
})

test('caret inside a replaced region clamps within new replaced span', () => {
  // old 'abcXYZdef' -> new 'abcQdef'; caret at 5 (inside XYZ)
  const r = mapCaretByDiff('abcXYZdef', 'abcQdef', 5)
  assert.ok(r >= 3 && r <= 4, `expected 3..4, got ${r}`)
})

test('caret at 0 stays 0 on prepend', () => {
  assert.equal(mapCaretByDiff('bar', 'foobar', 0), 0)
})

test('full replacement clamps into bounds', () => {
  const r = mapCaretByDiff('abc', 'XYZW', 2)
  assert.ok(r >= 0 && r <= 4, `expected within 0..4, got ${r}`)
})

test('empty old string maps caret to insertion end region', () => {
  // '' -> 'abc'; caret 0 -> 0 (prefix empty, suffix empty, replaced region [0,3])
  const r = mapCaretByDiff('', 'abc', 0)
  assert.ok(r >= 0 && r <= 3)
})
