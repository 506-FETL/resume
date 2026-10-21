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
  const { resolveTemplateReference, DEFAULT_TEMPLATE_REF } = await server.ssrLoadModule('/src/lib/resume-template/compatibility/binding.ts')
  const legacy = await fixture('legacy-cases')
  for (const binding of legacy.bindings) {
    const before = JSON.stringify(binding)
    assert.deepEqual(resolveTemplateReference(binding), DEFAULT_TEMPLATE_REF)
    assert.equal(JSON.stringify(binding), before)
  }
  assert.deepEqual(resolveTemplateReference({ source: 'official', templateId: 'default', templateVersion: 2 }), { templateId: 'default', templateVersion: 2 })
  for (const version of [0, null, '1', -1, 1.5]) {
    assert.throws(() => resolveTemplateReference({ source: 'official', templateId: 'default', templateVersion: version }))
  }
  assert.throws(() => resolveTemplateReference([]))
  assert.throws(() => resolveTemplateReference({ source: 'user', templateId: 'x', templateVersion: 1 }))
  console.log('PASS 新旧绑定区分、精确版本及输入隔离')
}
finally {
  await server.close()
}
