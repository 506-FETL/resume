import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, watch: null, ws: false }, appType: 'custom' })
const fixture = async (name: string) => JSON.parse(await readFile(new URL(`./fixtures/resume-template/${name}.json`, import.meta.url), 'utf8'))

try {
  const snapshot = await fixture('all-sections')
  const baseline = await fixture('projection-baseline')
  const { buildCommentAnchorDocument } = await server.ssrLoadModule('/src/features/resume-comments/anchors/document.ts')
  assert.deepEqual(buildCommentAnchorDocument(snapshot, '2026-10-21'), baseline)
  console.log('PASS 默认简历评论投影与固定基线一致')
}
finally {
  await server.close()
}
