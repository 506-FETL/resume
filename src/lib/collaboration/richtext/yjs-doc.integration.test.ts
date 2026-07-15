import assert from 'node:assert/strict'
import { test } from 'node:test'
import { RichTextCollabSession } from './yjs-doc.ts'

test('getFieldFragment returns the same fragment for the same key', () => {
  const session = new RichTextCollabSession()
  const a = session.getFieldFragment('self_evaluation.content')
  const b = session.getFieldFragment('self_evaluation.content')
  assert.equal(a, b)
  const c = session.getFieldFragment('hobbies.description')
  assert.notEqual(a, c)
  session.destroy()
})

test('setLocalUser writes user into awareness local state', () => {
  const session = new RichTextCollabSession()
  session.setLocalUser({ name: 'Alice', color: '#ff0000' })
  const local = session.awareness.getLocalState()
  assert.deepEqual(local?.user, { name: 'Alice', color: '#ff0000' })
  session.destroy()
})
