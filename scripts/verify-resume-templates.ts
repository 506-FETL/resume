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
  const { buildTemplateResumeData } = await server.ssrLoadModule('/src/components/resume/runtime/context/resume-data-context.tsx')
  const { adaptResumeContent } = await server.ssrLoadModule('/src/lib/resume-template/content/adapt-resume.ts')
  const beforeAdapt = JSON.stringify(snapshot)
  const nodes = new Map(baseline.document.nodes.map((node: { nodeKey: string }) => [node.nodeKey, node]))
  const data = buildTemplateResumeData(snapshot)
  const adapted = adaptResumeContent(data, nodes)
  assert.deepEqual(adaptResumeContent(data, nodes), adapted)
  assert.equal(JSON.stringify(snapshot), beforeAdapt)
  const work = adapted.sections.find((section: { key: string }) => section.key === 'work_experience')
  assert.equal(work.blocks[0].items.length, 2)
  assert.equal(work.blocks[0].items[0].title.nodeKey, 'work_experience/demo_work_experience_1/companyName')
  assert.equal(adapted.sections.find((section: { key: string }) => section.key === 'skill_specialty').blocks.length, 2)
  assert.deepEqual(adaptResumeContent({ ...data, order: [...data.order].reverse() }, nodes).sections.map((section: { key: string }) => section.key), [...adapted.sections].reverse().map((section: { key: string }) => section.key))
  assert.equal(adaptResumeContent({ ...data, getVisibility: () => false }, nodes).sections.length, 0)
  console.log('PASS 内容适配身份、顺序、隐藏和多内容块语义')
  const { createTemplateResourceStore } = await server.ssrLoadModule('/src/store/resume-template/index.ts')
  const { resolveTemplate } = await server.ssrLoadModule('/src/lib/resume-template/runtime/resolve-template.ts')
  const requests: Array<(value: unknown) => void> = []
  const testSource = {
    ...localTemplateSource,
    getTemplateVersion: () => new Promise(resolve => requests.push(resolve)),
  }
  const resources = createTemplateResourceStore(testSource)
  const firstLoad = resources.getState().loadDefinition(DEFAULT_TEMPLATE_REF)
  const duplicatedLoad = resources.getState().loadDefinition(DEFAULT_TEMPLATE_REF)
  assert.equal(firstLoad, duplicatedLoad)
  await Promise.resolve()
  const forcedLoad = resources.getState().loadDefinition(DEFAULT_TEMPLATE_REF, true)
  await Promise.resolve()
  requests[1](definition)
  await forcedLoad
  requests[0]({ ...definition, version: 99 })
  await firstLoad
  assert.equal(resources.getState().definitions['default@1'].status, 'ready')
  assert.equal(resources.getState().definitions['default@1'].data.version, 1)
  await assert.rejects(() => resolveTemplate({ ...localTemplateSource, getTemplateVersion: async () => ({ ...definition, version: 99 }) }, { source: 'official', ...DEFAULT_TEMPLATE_REF }))
  console.log('PASS 资源请求去重、过期结果隔离及引用匹配')
}
finally {
  await server.close()
}
