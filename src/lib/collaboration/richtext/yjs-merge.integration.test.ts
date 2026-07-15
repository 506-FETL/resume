import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as Y from 'yjs'

// 证明富文本正文用 Yjs 时，同一 fragment 的并发编辑按字符无冲突合并
// （对应 spec §7 首条：两人同改同一富文本字段字符级合并、互不覆盖）。
// 用一个段落里的 XmlText 模拟富文本文本节点。

function makeParagraphWithText(doc: Y.Doc, fragmentKey: string, initial: string) {
  const fragment = doc.getXmlFragment(fragmentKey)
  const paragraph = new Y.XmlElement('paragraph')
  const text = new Y.XmlText()
  if (initial) {
    text.insert(0, initial)
  }
  paragraph.insert(0, [text])
  fragment.insert(0, [paragraph])
  return text
}

function getText(doc: Y.Doc, fragmentKey: string): string {
  const fragment = doc.getXmlFragment(fragmentKey)
  const paragraph = fragment.get(0) as Y.XmlElement
  const text = paragraph.get(0) as Y.XmlText
  return text.toString()
}

test('concurrent inserts into the same rich-text fragment merge character-by-character', () => {
  const key = 'self_evaluation.content'

  // 共同起点
  const base = new Y.Doc()
  makeParagraphWithText(base, key, 'Hello')
  const baseState = Y.encodeStateAsUpdate(base)

  // 两个协作者各自从同一起点分叉
  const alice = new Y.Doc()
  Y.applyUpdate(alice, baseState)
  const bob = new Y.Doc()
  Y.applyUpdate(bob, baseState)

  // Alice 在开头插 'Dr. '；Bob 在结尾插 ' World'
  const aliceText = (alice.getXmlFragment(key).get(0) as Y.XmlElement).get(0) as Y.XmlText
  aliceText.insert(0, 'Dr. ')
  const bobText = (bob.getXmlFragment(key).get(0) as Y.XmlElement).get(0) as Y.XmlText
  bobText.insert(5, ' World') // 'Hello' 之后

  // 交换更新并合并
  const aliceUpdate = Y.encodeStateAsUpdate(alice)
  const bobUpdate = Y.encodeStateAsUpdate(bob)
  Y.applyUpdate(alice, bobUpdate)
  Y.applyUpdate(bob, aliceUpdate)

  const aliceResult = getText(alice, key)
  const bobResult = getText(bob, key)

  // 两处编辑都保留，不是二选一覆盖；两端收敛一致
  assert.equal(aliceResult, bobResult, '两端收敛一致')
  assert.ok(aliceResult.includes('Dr.'), `保留 Alice 前缀，实际: ${aliceResult}`)
  assert.ok(aliceResult.includes('World'), `保留 Bob 后缀，实际: ${aliceResult}`)
  assert.ok(aliceResult.includes('Hello'), `保留公共部分，实际: ${aliceResult}`)
})

test('concurrent edits to DIFFERENT fragments are independent', () => {
  const base = new Y.Doc()
  makeParagraphWithText(base, 'self_evaluation.content', 'A')
  makeParagraphWithText(base, 'hobbies.description', 'B')
  const baseState = Y.encodeStateAsUpdate(base)

  const alice = new Y.Doc()
  Y.applyUpdate(alice, baseState)
  const bob = new Y.Doc()
  Y.applyUpdate(bob, baseState)

  // Alice 改字段1，Bob 改字段2
  ;((alice.getXmlFragment('self_evaluation.content').get(0) as Y.XmlElement).get(0) as Y.XmlText).insert(1, 'X')
  ;((bob.getXmlFragment('hobbies.description').get(0) as Y.XmlElement).get(0) as Y.XmlText).insert(1, 'Y')

  Y.applyUpdate(alice, Y.encodeStateAsUpdate(bob))
  Y.applyUpdate(bob, Y.encodeStateAsUpdate(alice))

  assert.equal(getText(alice, 'self_evaluation.content'), 'AX')
  assert.equal(getText(alice, 'hobbies.description'), 'BY')
  assert.equal(getText(bob, 'self_evaluation.content'), 'AX')
  assert.equal(getText(bob, 'hobbies.description'), 'BY')
})
