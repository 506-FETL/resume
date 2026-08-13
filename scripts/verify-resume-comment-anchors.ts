import type { CommentAnchor, CommentAnchorDocumentNode } from '../src/features/resume-comments/anchors/types.ts'
import assert from 'node:assert/strict'
import { mergeCommentPageRects } from '../src/features/resume-comments/anchors/geometry.ts'
import {
  graphemeOffsetToTextPoint,
  graphemeOffsetToUtf16Offset,
  graphemeSlice,
  normalizeCommentText,
  textPointToGraphemeOffset,
  utf16OffsetToGraphemeOffset,
} from '../src/features/resume-comments/anchors/graphemes.ts'
import { relocateAnchor } from '../src/features/resume-comments/anchors/relocate.ts'
import {
  areCommentSelectionBoundariesCompatible,
  compareAnchorOverlap,
} from '../src/features/resume-comments/anchors/selection.ts'
import { resolveCommentPermissions } from '../src/features/resume-comments/types.ts'
import {
  buildCommentAnchorDocument,
  countCommentGraphemes,
  projectCommentRichTextBlocks,
  sha256Hex,
} from '../supabase/functions/shared/resume-comment-core.ts'

const resume = {
  basics: {
    name: '张三',
    gender: '男',
    birthMonth: '1990-09',
    phone: '13800000000',
    email: 'zhang@example.com',
    workYears: '5-10年',
    nation: '汉族',
    nativePlace: '江苏南京',
    heightCm: 180,
    weightKg: 70,
  },
  job_intent: {
    jobIntent: '前端工程师',
    intentionalCity: '上海',
    expectedSalary: 30,
    dateEntry: '1个月内',
  },
  application_info: {
    applicationSchool: '示例大学',
    applicationMajor: '计算机科学',
  },
  edu_background: {
    items: [{
      entryId: 'edu-1',
      schoolName: '示例大学',
      professional: '计算机科学',
      degree: '本科',
      duration: ['2010-09-01', '2014-06-30'],
      eduInfo: '<p>主修软件工程</p>',
    }],
  },
  work_experience: {
    items: [{
      entryId: 'work-1',
      companyName: '示例科技',
      position: '高级工程师',
      workDuration: ['2020-01', ''],
      workInfo: '<p>第一段 &amp;</p><ul><li>第二<strong>段</strong></li></ul><script>不能出现</script>',
    }],
  },
  internship_experience: { items: [] },
  campus_experience: { items: [] },
  project_experience: { items: [] },
  skill_specialty: {
    description: '<p>熟悉 Web 标准</p>',
    skills: [{ entryId: 'skill-1', label: 'TypeScript', proficiencyLevel: '精通' }],
  },
  honors_certificates: {
    description: '',
    certificates: [
      { entryId: 'duplicate-certificate', name: '英语六级' },
      { entryId: 'duplicate-certificate', name: '英语六级' },
    ],
  },
  self_evaluation: { content: '<blockquote>可靠 &amp; 专注</blockquote>' },
  hobbies: {
    description: '<p>隐藏内容</p>',
    hobbies: [{ entryId: 'hobby-1', name: '摄影' }],
  },
  visibility: { hobbies: true },
  order: [
    'basics',
    'job_intent',
    'application_info',
    'edu_background',
    'work_experience',
    'skill_specialty',
    'honors_certificates',
    'self_evaluation',
    'hobbies',
  ],
}

assert.equal(
  sha256Hex('abc'),
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
)
assert.equal(normalizeCommentText('e\u0301'), 'é')
assert.equal(countCommentGraphemes('e\u0301'), 1)
assert.equal(countCommentGraphemes('👨‍👩‍👧‍👦'), 1)
assert.equal(graphemeSlice('中文👨‍👩‍👧‍👦A', 1, 3), '文👨‍👩‍👧‍👦')

const family = '👨‍👩‍👧‍👦'
assert.equal(utf16OffsetToGraphemeOffset(family, 1), 0)
assert.equal(utf16OffsetToGraphemeOffset(family, family.length), 1)
assert.equal(graphemeOffsetToUtf16Offset(`${family}A`, 1), family.length)

const crossDomText = [{ data: 'e' }, { data: '\u0301x' }]
assert.equal(textPointToGraphemeOffset(crossDomText, crossDomText[1], 1), 1)
assert.deepEqual(
  graphemeOffsetToTextPoint(crossDomText, 1),
  { textNode: crossDomText[1], utf16Offset: 1 },
)

assert.deepEqual(
  projectCommentRichTextBlocks('<p>Hello &amp; 世界</p><li>第二<strong>段</strong></li><style>bad</style>'),
  [{ text: 'Hello & 世界' }, { text: '第二段' }],
)

const firstBuild = buildCommentAnchorDocument(resume, '2026-08-13')
const secondBuild = buildCommentAnchorDocument(structuredClone(resume), '2026-08-13')
assert.deepEqual(firstBuild, secondBuild)
assert.equal(firstBuild.document.projectionReferenceDate, '2026-08-13')
assert.match(firstBuild.documentHash, /^[0-9a-f]{64}$/)

const nodeByKey = new Map(firstBuild.document.nodes.map(node => [node.nodeKey, node]))
assert.equal(nodeByKey.get('basics/singleton/age')?.text, '35岁')
assert.equal(nodeByKey.get('job_intent/singleton/expectedSalary')?.text, '30K')
assert.equal(nodeByKey.get('application_info/singleton/applicationSchool')?.text, '申请院校：示例大学')
assert.equal(nodeByKey.get('edu_background/edu-1/professionalDegree')?.text, '计算机科学 / 本科')
assert.equal(nodeByKey.get('edu_background/edu-1/duration')?.text, '2010-09 - 2014-06')
assert.equal(nodeByKey.get('work_experience/work-1/duration')?.text, '2020-01 - 至今')
assert.equal(nodeByKey.get('skill_specialty/skill-1/skill')?.text, 'TypeScript · 精通')
assert.equal(nodeByKey.has('hobbies/hobby-1/name'), false)

const richNode = nodeByKey.get('work_experience/work-1/content')!
assert.equal(richNode.text, '第一段 &\n第二段')
assert.deepEqual(richNode.blocks, [
  { ordinal: 0, startGraphemeOffset: 0, endGraphemeOffset: 5 },
  { ordinal: 1, startGraphemeOffset: 6, endGraphemeOffset: 9 },
])

const certificateNodes = firstBuild.document.nodes.filter(node => (
  node.sectionKey === 'honors_certificates' && node.fieldKey === 'name'
))
assert.equal(certificateNodes.length, 2)
assert.notEqual(certificateNodes[0].nodeKey, certificateNodes[1].nodeKey)
assert.deepEqual(
  certificateNodes.map(node => node.nodeKey),
  secondBuild.document.nodes
    .filter(node => node.sectionKey === 'honors_certificates' && node.fieldKey === 'name')
    .map(node => node.nodeKey),
)

const reorderedBuild = buildCommentAnchorDocument({
  ...resume,
  order: [...resume.order].reverse(),
}, '2026-08-13')
assert.notEqual(firstBuild.documentHash, reorderedBuild.documentHash)
assert.notEqual(
  firstBuild.documentHash,
  buildCommentAnchorDocument(resume, '2027-08-13').documentHash,
)

function createAnchor(text: string, quote: string): CommentAnchor {
  const start = text.indexOf(quote)
  assert.notEqual(start, -1)
  return {
    nodeKey: 'work_experience/work-1/content',
    startGraphemeOffset: start,
    endGraphemeOffset: start + quote.length,
    blockOrdinal: 0,
    exactQuote: quote,
    prefix: text.slice(Math.max(0, start - 32), start),
    suffix: text.slice(start + quote.length, start + quote.length + 32),
    nodeTextHash: sha256Hex(text),
    createdAtContentHash: firstBuild.documentHash,
  }
}

function createNode(text: string): CommentAnchorDocumentNode {
  return {
    nodeKey: 'work_experience/work-1/content',
    sectionKey: 'work_experience',
    entryId: 'work-1',
    fieldKey: 'content',
    text,
    blocks: [{ ordinal: 0, startGraphemeOffset: 0, endGraphemeOffset: countCommentGraphemes(text) }],
    nodeTextHash: sha256Hex(text),
  }
}

const sourceText = 'alpha target omega'
const sourceAnchor = createAnchor(sourceText, 'target')
const unchanged = relocateAnchor(sourceAnchor, createNode(sourceText))
assert.equal(unchanged.status, 'anchored')
assert.equal(unchanged.status === 'anchored' && unchanged.moved, false)

const uniquelyMoved = relocateAnchor(sourceAnchor, createNode('new alpha target omega'))
assert.equal(uniquelyMoved.status, 'anchored')
assert.equal(uniquelyMoved.status === 'anchored' && uniquelyMoved.moved, true)
assert.equal(
  uniquelyMoved.status === 'anchored' && uniquelyMoved.anchor.startGraphemeOffset,
  10,
)

const changedContext = relocateAnchor(sourceAnchor, createNode('hello target changed'))
assert.equal(changedContext.status, 'anchored')
assert.equal(changedContext.status === 'anchored' && changedContext.contextChanged, true)

const ambiguous = relocateAnchor(sourceAnchor, createNode('target x target'))
assert.deepEqual(ambiguous, { status: 'detached', reason: 'ambiguous' })
assert.deepEqual(relocateAnchor(sourceAnchor, null), { status: 'detached', reason: 'node_missing' })

const adjacentAnchor = { ...sourceAnchor, startGraphemeOffset: 12, endGraphemeOffset: 15 }
const partialAnchor = { ...sourceAnchor, startGraphemeOffset: 10, endGraphemeOffset: 14 }
const containedAnchor = { ...sourceAnchor, startGraphemeOffset: 7, endGraphemeOffset: 10 }
assert.equal(compareAnchorOverlap(sourceAnchor, sourceAnchor), 'exact')
assert.equal(compareAnchorOverlap(sourceAnchor, adjacentAnchor), 'none')
assert.equal(compareAnchorOverlap(sourceAnchor, partialAnchor), 'partial')
assert.equal(compareAnchorOverlap(sourceAnchor, containedAnchor), 'contains')
assert.equal(
  areCommentSelectionBoundariesCompatible(
    { nodeKey: 'same', blockOrdinal: 0 },
    { nodeKey: 'same', blockOrdinal: 1 },
  ),
  false,
)

assert.deepEqual(
  mergeCommentPageRects([
    { pageIndex: 0, x: 20, y: 10, width: 8, height: 4 },
    { pageIndex: 0, x: 10, y: 10.4, width: 9, height: 4 },
    { pageIndex: 0, x: 10, y: 30, width: 4, height: 4 },
    { pageIndex: 1, x: 10, y: 10, width: 4, height: 4 },
  ]),
  [
    { pageIndex: 0, x: 10, y: 10, width: 18, height: 4.4 },
    { pageIndex: 0, x: 10, y: 30, width: 4, height: 4 },
    { pageIndex: 1, x: 10, y: 10, width: 4, height: 4 },
  ],
)

assert.equal(
  resolveCommentPermissions({ kind: 'owner', ownerUserId: 'owner' }).kind,
  'owner',
)
assert.equal(
  resolveCommentPermissions({
    kind: 'collaborator',
    userId: 'editor',
    sessionId: 'session',
    role: 'editor',
  }).kind,
  'collaborator_editor',
)
assert.equal(
  resolveCommentPermissions({
    kind: 'share_visitor',
    actor: { kind: 'anonymous', anonymousId: 'anonymous', secret: 'secret' },
    shareId: 'share',
    releaseId: 'release',
    commentsEnabled: false,
  }).kind,
  'share_reader',
)

console.warn('resume comment anchor verification passed')
