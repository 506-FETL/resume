import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  findDropContainer,
  findDropIndex,
  getEdgeScrollDelta,
  moveArrayItem,
} from '../src/lib/motion-drag.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const crossListSource = readFileSync(`${root}/src/components/ui/cross-list-drag.tsx`, 'utf8')
const reorderSource = readFileSync(`${root}/src/components/ui/motion-reorder.tsx`, 'utf8')

assert.deepEqual(moveArrayItem(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a'])
assert.deepEqual(moveArrayItem(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b'])
assert.deepEqual(moveArrayItem(['a', 'b'], -1, 1), ['a', 'b'])

const containers = [
  { id: 'main', top: 0, right: 100, bottom: 200, left: 0 },
  { id: 'sidebar', top: 0, right: 220, bottom: 200, left: 120 },
]
assert.equal(findDropContainer({ x: 20, y: 20 }, containers), 'main')
assert.equal(findDropContainer({ x: 150, y: 50 }, containers), 'sidebar')
assert.equal(findDropContainer({ x: 110, y: 50 }, containers), null)

const verticalItems = [
  { id: 'a', top: 0, right: 100, bottom: 40, left: 0 },
  { id: 'b', top: 50, right: 100, bottom: 90, left: 0 },
]
assert.equal(findDropIndex({ x: 20, y: 10 }, verticalItems, 'y'), 0)
assert.equal(findDropIndex({ x: 20, y: 45 }, verticalItems, 'y'), 1)
assert.equal(findDropIndex({ x: 20, y: 100 }, verticalItems, 'y'), 2)

assert.ok(getEdgeScrollDelta({ x: 5, y: 50 }, containers[0], 'x') < 0)
assert.ok(getEdgeScrollDelta({ x: 95, y: 50 }, containers[0], 'x') > 0)
assert.equal(getEdgeScrollDelta({ x: 50, y: 100 }, containers[0], 'x'), 0)

assert.match(crossListSource, /window\.addEventListener\('pointercancel'/u)
assert.match(crossListSource, /window\.addEventListener\('touchcancel'/u)
assert.match(crossListSource, /if \(event\.cancelable\)/u)
assert.match(crossListSource, /clearSession\(false\)/u)
assert.match(crossListSource, /createPortal/u)
assert.match(crossListSource, /data-motion-drag-item/u)
assert.match(reorderSource, /startSnapshotRef/u)
assert.match(reorderSource, /onCommitRef\.current\(next\)/u)

console.warn('motion drag verification passed')
