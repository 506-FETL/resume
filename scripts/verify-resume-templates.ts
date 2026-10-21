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
  const { localTemplateSource } = await server.ssrLoadModule('/src/lib/resume-template/source/local.ts')
  const { resumeSchema } = await server.ssrLoadModule('/src/lib/schema/index.ts')
  const { parseTemplateDefinition } = await server.ssrLoadModule('/src/lib/resume-template/definition-schema.ts')
  const catalog = await localTemplateSource.listTemplates()
  assert.equal(catalog.length, 1)
  assert.equal(catalog[0].templateId, 'default')
  const definition = await localTemplateSource.getTemplateVersion(DEFAULT_TEMPLATE_REF)
  for (const ref of catalog[0].examples) {
    const example = await localTemplateSource.getExample(ref)
    resumeSchema.parse(example.content)
    const name = example.content.basics.name
    example.content.basics.name = '修改返回值'
    assert.equal((await localTemplateSource.getExample(ref)).content.basics.name, name)
  }
  await assert.rejects(() => localTemplateSource.getTemplateVersion({ templateId: 'default', templateVersion: 2 }))
  assert.throws(() => parseTemplateDefinition({ ...definition, script: 'alert(1)' }))
  assert.throws(() => parseTemplateDefinition({ ...definition, schemaVersion: 2 }))
  assert.throws(() => parseTemplateDefinition({ ...definition, layout: { ...definition.layout, component: 'unknown@1' } }))
  assert.throws(() => parseTemplateDefinition({ ...definition, appearanceDefaults: { ...definition.appearanceDefaults, spacing: { ...definition.appearanceDefaults.spacing, lineHeight: 999 } } }))
  console.log('PASS 本地目录、完整示例、深复制隔离及配置校验')
}
finally {
  await server.close()
}
