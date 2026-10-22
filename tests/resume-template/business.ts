import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { createServer } from 'vite'

async function main() {
  const server = await createServer({ server: { middlewareMode: true, watch: null, ws: false }, appType: 'custom' })
  const fixture = async (path: string) => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'))
  try {
    const { resolveTemplateReference, toTemplateBinding } = await server.ssrLoadModule('/src/lib/resume-template/binding.ts')
    const { parseTemplateDefinition, TemplateResolutionError } = await server.ssrLoadModule('/src/lib/resume-template/definition-schema.ts')
    const { serializeTemplateForShare, parseSharedTemplateDefinition } = await server.ssrLoadModule('/src/lib/resume-template/share.ts')
    const { prepareTemplateResume, createdResumeResult } = await server.ssrLoadModule('/src/lib/resume-template/create/prepare.ts')
    const { persistPreparedResume } = await server.ssrLoadModule('/src/lib/resume-template/create/persist.ts')
    const { createResumeCreationStore } = await server.ssrLoadModule('/src/store/resume-creation/create-store.ts')
    const { getDefaultTemplateSelection } = await server.ssrLoadModule('/src/lib/resume-template/runtime/default-selection.ts')
    const catalog = await fixture('template-resources/catalog.json')
    const definitions = new Map()
    const examples = new Map()
    for (const item of catalog) {
      definitions.set(item.templateId, parseTemplateDefinition(await fixture(`template-resources/${item.templateId}/v2.json`)))
      for (const ref of item.examples)
        examples.set(`${ref.exampleId}@${ref.version}`, await fixture(`template-resources/examples/${ref.exampleId}/v${ref.version}.json`))
    }
    const source = {
      listTemplatePage: async () => ({ items: structuredClone(catalog), nextOffset: null }),
      getCatalogFacets: async () => ({ styles: [], layouts: [] }),
      listTemplates: async () => structuredClone(catalog),
      getAsset: async () => new Blob(),
      retainResource: () => () => {},
      getTemplateVersion: async (ref: { templateId: string, templateVersion: number }) => {
        const definition = definitions.get(ref.templateId)
        if (!definition || definition.version !== ref.templateVersion)
          throw new TemplateResolutionError('VERSION_NOT_FOUND', 'missing')
        return structuredClone(definition)
      },
      getExample: async (ref: { exampleId: string, version: number }) => {
        const value = examples.get(`${ref.exampleId}@${ref.version}`)
        if (!value)
          throw new TemplateResolutionError('VERSION_NOT_FOUND', 'missing')
        return structuredClone(value)
      },
    }
    const ref = { templateId: 'default', templateVersion: 2 }
    for (const invalid of [undefined, null, {}, [], { type: 'default' }, { source: 'official', templateId: 'default' }, { source: 'user', ...ref }, { source: 'official', ...ref, extra: true }, ...[0, -1, null, '2', 1.5].map(templateVersion => ({ source: 'official', ...ref, templateVersion }))])
      assert.throws(() => resolveTemplateReference(invalid), { code: 'INVALID_BINDING' })
    const binding = toTemplateBinding(ref)
    const beforeBinding = JSON.stringify(binding)
    assert.deepEqual(resolveTemplateReference(binding), ref)
    assert.equal(JSON.stringify(binding), beforeBinding)
    assert.deepEqual(await getDefaultTemplateSelection(source), { template: ref, example: catalog[0].defaultExample })
    const offsets: number[] = []
    assert.deepEqual(await getDefaultTemplateSelection({ ...source, listTemplatePage: async ({ offset }: { offset: number }) => {
      offsets.push(offset)
      return offset === 0 ? { items: [catalog[1]], nextOffset: 12 } : { items: [catalog[0]], nextOffset: null }
    } }), { template: ref, example: catalog[0].defaultExample })
    assert.deepEqual(offsets, [0, 12])
    await assert.rejects(() => getDefaultTemplateSelection({ ...source, listTemplatePage: async () => ({ items: [], nextOffset: null }) }), { code: 'VERSION_NOT_FOUND' })
    process.stdout.write('PASS 严格绑定无默认回退、输入隔离、默认创建读取分页目录精确引用\n')

    for (const item of catalog) {
      const definition = definitions.get(item.templateId)
      const frozen = serializeTemplateForShare(definition)
      assert.deepEqual(parseSharedTemplateDefinition(JSON.parse(JSON.stringify(frozen))), definition)
      assert.throws(() => parseSharedTemplateDefinition({ ...frozen, schemaVersion: 1 }))
      assert.throws(() => parseSharedTemplateDefinition({ ...frozen, templateVersion: 99 }), { code: 'REFERENCE_MISMATCH' })
      assert.throws(() => parseSharedTemplateDefinition({ ...frozen, assets: [{ id: 'forged' }] }), { code: 'REFERENCE_MISMATCH' })
      assert.throws(() => parseSharedTemplateDefinition({ ...frozen, definition: null }))
      const { definition: _definition, ...incomplete } = frozen
      assert.throws(() => parseSharedTemplateDefinition(incomplete))
      const original = JSON.stringify(definition)
      frozen.definition.tokens.primary = '#000000'
      assert.equal(JSON.stringify(definition), original)
      const withAsset = structuredClone(definition)
      withAsset.assets = [{ id: 'test-image', sha256: 'a'.repeat(64), mimeType: 'image/png', bytes: 100, width: 1, height: 1, required: true }]
      const assetsEnvelope = serializeTemplateForShare(withAsset)
      assetsEnvelope.assets[0].sha256 = 'b'.repeat(64)
      assert.throws(() => parseSharedTemplateDefinition(assetsEnvelope), { code: 'REFERENCE_MISMATCH' })
      assert.equal(withAsset.assets[0].sha256, 'a'.repeat(64))
    }
    process.stdout.write('PASS schema2分享信封往返、冻结深复制、缺定义/版本/素材篡改拒绝\n')

    const input = { template: ref, example: catalog[0].defaultExample, mode: 'local', displayName: ' 测试简历 ', description: ' 测试说明 ' }
    const ids = (value: unknown): string[] => JSON.stringify(value).match(/"entryId":"([^"]+)"/g) ?? []
    for (const item of catalog) {
      for (const example of item.examples) {
        const selection = { ...input, template: { templateId: item.templateId, templateVersion: item.currentVersion }, example }
        const beforeExample = JSON.stringify(examples.get(`${example.exampleId}@${example.version}`))
        const first = await prepareTemplateResume(selection, source, { operationId: crypto.randomUUID(), ownerId: null })
        const second = await prepareTemplateResume(selection, source, { operationId: crypto.randomUUID(), ownerId: null })
        assert.ok(ids(first.snapshot).length > 0)
        assert.equal(ids(first.snapshot).some(id => ids(second.snapshot).includes(id)), false)
        assert.deepEqual(first.snapshot.templateBinding, { source: 'official', ...selection.template })
        assert.deepEqual(first.snapshot.font, definitions.get(item.templateId).appearanceDefaults.font)
        assert.equal(first.displayName, '测试简历')
        assert.equal(first.description, '测试说明')
        first.snapshot.basics.name = '只修改新建简历'
        first.snapshot.order.reverse()
        assert.equal(JSON.stringify(examples.get(`${example.exampleId}@${example.version}`)), beforeExample)
        assert.notEqual(second.snapshot.basics.name, '只修改新建简历')
      }
    }
    await assert.rejects(() => prepareTemplateResume({ ...input, mode: 'cloud' }, source, { operationId: crypto.randomUUID(), ownerId: null }))
    await assert.rejects(() => prepareTemplateResume(input, source, { operationId: 'invalid', ownerId: null }))
    process.stdout.write('PASS 两模板两示例完整创建、entryId隔离、外观复制一次、输入示例不变\n')

    const prepared = await prepareTemplateResume(input, source, { operationId: crypto.randomUUID(), ownerId: null })
    const result = createdResumeResult(prepared, { resume_id: prepared.resumeId, created_at: new Date().toISOString() })
    let stored: unknown = null
    let inserts = 0
    const persistence = {
      find: async () => stored,
      insert: async () => {
        inserts++
        stored = result
        throw new Error('response lost')
      },
    }
    assert.deepEqual(await persistPreparedResume(prepared, persistence), result)
    // 已创建简历即使已经继续编辑，重试也只查找，不再插入/覆盖快照。
    const editedSnapshot = structuredClone(prepared.snapshot)
    editedSnapshot.basics.name = '已经编辑的内容'
    const beforeSnapshot = JSON.stringify(editedSnapshot)
    assert.deepEqual(await persistPreparedResume(prepared, persistence), result)
    assert.equal(JSON.stringify(editedSnapshot), beforeSnapshot)
    assert.equal(inserts, 1)
    await assert.rejects(() => persistPreparedResume(prepared, { ...persistence, find: async () => {
      throw new Error('query failed')
    } }))
    assert.equal(inserts, 1)

    let finishSave: (value: unknown) => void = () => {}
    const creation = createResumeCreationStore({ source, getOwnerId: () => null, persistence: { find: async () => null, insert: () => new Promise((resolve) => {
      finishSave = resolve
    }) } })
    const firstCreate = creation.getState().start(input)
    assert.equal(creation.getState().start(input), firstCreate)
    while (creation.getState().status !== 'saving') await new Promise(resolve => setTimeout(resolve, 0))
    await new Promise(resolve => setTimeout(resolve, 0))
    creation.getState().reset()
    assert.equal(creation.getState().status, 'saving')
    finishSave(result)
    await firstCreate
    assert.equal(creation.getState().status, 'success')

    let reads = 0
    let shouldFail = true
    const retry = createResumeCreationStore({ source: { ...source, getExample: async (value: { exampleId: string, version: number }) => {
      reads++
      return source.getExample(value)
    } }, getOwnerId: () => null, persistence: { find: async () => null, insert: async (value: typeof prepared) => {
      if (shouldFail)
        throw new Error('temporary failure')
      return createdResumeResult(value, { resume_id: value.resumeId, created_at: new Date().toISOString() })
    } } })
    await assert.rejects(() => retry.getState().start(input))
    const retryId = retry.getState().prepared.resumeId
    const retrySnapshot = JSON.stringify(retry.getState().prepared.snapshot)
    retry.getState().reset()
    assert.equal(retry.getState().prepared.resumeId, retryId)
    shouldFail = false
    assert.equal((await retry.getState().retry()).resumeId, retryId)
    assert.equal(JSON.stringify(retry.getState().prepared.snapshot), retrySnapshot)
    assert.equal(reads, 1)
    process.stdout.write('PASS 创建连击合并、关闭不丢操作、结果丢失重查、重试沿用快照且不覆写\n')

    const { buildCommentAnchorDocument } = await server.ssrLoadModule('/src/features/resume-comments/anchors/document.ts')
    const { redactHiddenResumeSections } = await server.ssrLoadModule('/supabase/functions/shared/resume-share-redaction.ts')
    const snapshot = await fixture('tests/resume-template/fixtures/all-sections.json')
    const firstDocument = buildCommentAnchorDocument({ ...snapshot, templateBinding: toTemplateBinding(ref) }, '2026-10-22')
    const secondDocument = buildCommentAnchorDocument({ ...snapshot, templateBinding: toTemplateBinding({ templateId: 'classic-ribbon', templateVersion: 2 }) }, '2026-10-22')
    assert.deepEqual(firstDocument, secondDocument)
    snapshot.visibility.work_experience = true
    const beforeRedaction = JSON.stringify(snapshot)
    const publicSnapshot = redactHiddenResumeSections(snapshot)
    assert.equal(JSON.stringify(publicSnapshot).includes(snapshot.work_experience.items[0].companyName), false)
    assert.equal(JSON.stringify(snapshot), beforeRedaction)
    process.stdout.write('PASS 新模板绑定不改变评论字段身份、分享隐藏内容脱敏且不修改原始快照\n')
  }
  finally { await server.close() }
}
main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
