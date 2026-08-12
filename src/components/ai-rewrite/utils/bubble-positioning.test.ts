/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clipRect,
  combineRects,
  getBubbleDisplayMode,
  getPositionSelectionRects,
  getVisibleSelectionRects,
} from './bubble-positioning.ts'

test('clipRect 将部分可见矩形裁剪到编辑器边界', () => {
  assert.deepEqual(
    clipRect(
      { left: -5, top: 10, right: 30, bottom: 30, width: 35, height: 20 },
      { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 },
    ),
    { left: 0, top: 10, right: 30, bottom: 30, width: 30, height: 20 },
  )
})

test('getVisibleSelectionRects 丢弃零尺寸和完全不可见文本行', () => {
  assert.deepEqual(
    getVisibleSelectionRects(
      [
        { left: 5, top: 5, right: 5, bottom: 20, width: 0, height: 15 },
        { left: 10, top: -30, right: 40, bottom: -10, width: 30, height: 20 },
        { left: 10, top: 10, right: 40, bottom: 30, width: 30, height: 20 },
      ],
      { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 },
    ),
    [{ left: 10, top: 10, right: 40, bottom: 30, width: 30, height: 20 }],
  )
})

test('getPositionSelectionRects 在选区完全滚出时保留原始行供 hide 判断', () => {
  const rawRects = [
    { left: 10, top: -40, right: 60, bottom: -20, width: 50, height: 20 },
  ]

  assert.deepEqual(
    getPositionSelectionRects(
      rawRects,
      { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 },
    ),
    rawRects,
  )
})

test('combineRects 合并多行选区边界', () => {
  assert.deepEqual(
    combineRects([
      { left: 40, top: 10, right: 90, bottom: 30, width: 50, height: 20 },
      { left: 10, top: 30, right: 70, bottom: 50, width: 60, height: 20 },
    ]),
    { left: 10, top: 10, right: 90, bottom: 50, width: 80, height: 40 },
  )
})

test('getBubbleDisplayMode 在完整菜单刚好可容纳时保持 full', () => {
  assert.equal(
    getBubbleDisplayMode({
      availableWidth: 420,
      fullWidth: 420,
      compactWidth: 32,
    }),
    'full',
  )
})

test('getBubbleDisplayMode 在完整菜单超宽时切换 compact', () => {
  assert.equal(
    getBubbleDisplayMode({
      availableWidth: 419,
      fullWidth: 420,
      compactWidth: 32,
    }),
    'compact',
  )
})

test('getBubbleDisplayMode 在省略号按钮也放不下时隐藏', () => {
  assert.equal(
    getBubbleDisplayMode({
      availableWidth: 31,
      fullWidth: 420,
      compactWidth: 32,
    }),
    'hidden',
  )
})
