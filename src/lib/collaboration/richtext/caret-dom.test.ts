import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Window } from 'happy-dom'
import { createCollaborationCaret } from './caret-dom.ts'

function withTestDocument(run: () => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const window = new Window()
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: window.document,
  })
  try {
    run()
  }
  finally {
    window.close()
    if (previous)
      Object.defineProperty(globalThis, 'document', previous)
    else
      Reflect.deleteProperty(globalThis, 'document')
  }
}

test('creates one legal inline caret label without changing user styling', () => {
  withTestDocument(() => {
    const caret = createCollaborationCaret({ name: 'seams', color: '#6255f6' })
    const labels = caret.querySelectorAll('.collaboration-carets__label')

    assert.equal(caret.tagName, 'SPAN')
    assert.equal(caret.className, 'collaboration-carets__caret')
    assert.equal(caret.style.borderColor, '#6255f6')
    assert.equal(labels.length, 1)
    assert.equal(labels[0]?.tagName, 'SPAN')
    assert.equal(labels[0]?.textContent, 'seams')
    assert.equal((labels[0] as HTMLElement).style.backgroundColor, '#6255f6')
  })
})

test('uses an empty label when the remote user name is missing', () => {
  withTestDocument(() => {
    const caret = createCollaborationCaret({ color: '#6255f6' })
    assert.equal(caret.querySelector('.collaboration-carets__label')?.textContent, '')
  })
})
