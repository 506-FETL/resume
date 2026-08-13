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
const mobileSortSource = readFileSync(`${root}/src/pages/resume/editor/components/sidebar/mobile-sort-drawer.tsx`, 'utf8')
const desktopTabsSource = readFileSync(`${root}/src/pages/resume/editor/components/sidebar/index.tsx`, 'utf8')
const accordionSource = readFileSync(`${root}/src/pages/resume/editor/components/edit-panel/accordion-editor.tsx`, 'utf8')
const templateStructureSource = readFileSync(`${root}/src/pages/template/components/editor/structure-panel.tsx`, 'utf8')
const trackerBoardSource = readFileSync(`${root}/src/pages/tracker/components/board/index.tsx`, 'utf8')

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
assert.match(mobileSortSource, /useMotionReorder/u)
assert.match(mobileSortSource, /data-base-ui-swipe-ignore/u)
assert.match(desktopTabsSource, /Reorder\.Group/u)
assert.match(desktopTabsSource, /useMotionReorder/u)
assert.match(accordionSource, /Reorder\.Group/u)
assert.match(accordionSource, /useMotionReorder/u)
assert.doesNotMatch(desktopTabsSource, /@hello-pangea\/dnd/u)
assert.doesNotMatch(accordionSource, /@hello-pangea\/dnd/u)
assert.match(templateStructureSource, /CrossListDragProvider/u)
assert.match(templateStructureSource, /useCrossListContainer/u)
assert.match(templateStructureSource, /useCrossListItem/u)
assert.match(templateStructureSource, /moveSectionRegion/u)
assert.doesNotMatch(templateStructureSource, /@hello-pangea\/dnd/u)
assert.match(trackerBoardSource, /CrossListDragProvider/u)
assert.match(trackerBoardSource, /useCrossListContainer/u)
assert.match(trackerBoardSource, /useCrossListItem/u)
assert.match(trackerBoardSource, /sourceId === destinationId/u)
assert.match(trackerBoardSource, /newStatus === 'offer' \|\| newStatus === 'rejected'/u)
assert.doesNotMatch(trackerBoardSource, /@hello-pangea\/dnd/u)
assert.doesNotMatch(trackerBoardSource, /window\.addEventListener\('mousemove'/u)

console.warn('motion drag verification passed')
