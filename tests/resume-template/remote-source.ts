import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { createServer } from 'vite'

async function main() {
  const server = await createServer({ server: { middlewareMode: true, watch: null, ws: false }, appType: 'custom' })
  const read = async (path: string) => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'))
  const envelope = (value: unknown) => {
    const content = JSON.stringify(value)
    return { content, content_hash: createHash('sha256').update(content).digest('hex') }
  }
  try {
    const { createRemoteTemplateSource, CATALOG_TTL_MS } = await server.ssrLoadModule('/src/lib/resume-template/source/remote.ts')
    const { createTemplateTransport } = await server.ssrLoadModule('/src/lib/resume-template/source/transport.ts')
    const { TemplateResolutionError } = await server.ssrLoadModule('/src/lib/resume-template/definition-schema.ts')
    const { cacheEvictions, MAX_CACHE_BYTES } = await server.ssrLoadModule('/src/lib/resume-template/source/cache.ts')
    const { catalogItemSchema } = await server.ssrLoadModule('/src/lib/resume-template/source/resource-schema.ts')
    const { createTemplateResourceStore } = await server.ssrLoadModule('/src/store/resume-template/index.ts')
    const catalog = await read('template-resources/catalog.json')
    const definitions = new Map<string, unknown>()
    const examples = new Map<string, unknown>()
    for (const item of catalog) {
      definitions.set(item.templateId, envelope(await read(`template-resources/${item.templateId}/v2.json`)))
      for (const ref of item.examples)
        examples.set(ref.exampleId, envelope(await read(`template-resources/examples/${ref.exampleId}/v${ref.version}.json`)))
    }
    const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2f0kAAAAASUVORK5CYII=', 'base64')
    const hash = createHash('sha256').update(bytes).digest('hex')
    const assetRef = { hash, mimeType: 'image/png', byteLength: bytes.length, width: 1, height: 1 }
    let asset = { content_hash: hash, mime_type: 'image/png', byte_size: bytes.length, width: 1, height: 1, content_base64: bytes.toString('base64') }
    const disk = new Map()
    const cache = {
      get: async (key: string) => structuredClone(disk.get(key)),
      set: async (record: { key: string }) => { disk.set(record.key, structuredClone(record)) },
      delete: async (key: string) => { disk.delete(key) },
    }
    let calls = 0
    let offline = false
    let clock = 100000
    const transport = async (path: string, params: Record<string, string> = {}) => {
      calls++
      await new Promise(resolve => setTimeout(resolve, 2))
      if (offline)
        throw new TemplateResolutionError('LOAD_FAILED', 'offline')
      if (path.endsWith('_catalog'))
        return catalog.filter((item: { category: { style: string } }) => !params.style || `eq.${item.category.style}` === params.style).slice(Number(params.offset), Number(params.offset) + Number(params.limit)).map((metadata: unknown) => ({ metadata }))
      if (path.startsWith('rpc/'))
        return { styles: ['简约', '经典'], layouts: ['单栏'] }
      if (path === 'official_resume_assets')
        return params.content_hash === `eq.${hash}` ? [asset] : []
      const values = path.endsWith('_template_versions') ? definitions : examples
      const id = (params.template_id ?? params.example_id).slice(3)
      const version = path.endsWith('_template_versions') ? 'eq.2' : 'eq.1'
      return params.version === version && values.has(id) ? [structuredClone(values.get(id))] : []
    }
    const build = () => createRemoteTemplateSource({ transport, cache, now: () => clock })
    let source = build()
    const ref = { templateId: 'default', templateVersion: 2 }
    const loaded = await Promise.all(Array.from({ length: 20 }, () => source.getTemplateVersion(ref)))
    assert.equal(calls, 1)
    loaded[0].version = 99
    assert.equal(loaded[1].version, 2)
    assert.equal((await source.getTemplateVersion(ref)).version, 2)
    source = build()
    assert.equal((await source.getTemplateVersion(ref)).version, 2)
    assert.equal(calls, 1)
    process.stdout.write('PASS 20 路请求合并、返回隔离、精确版本内存及持久缓存\n')

    assert.equal((await source.listTemplatePage()).items.length, 2)
    await source.getExample(catalog[0].defaultExample)
    const blobs = await Promise.all([source.getAsset(assetRef), source.getAsset(assetRef)])
    assert.equal(blobs[0].size, bytes.length)
    const warmCalls = calls
    offline = true
    source = build()
    assert.equal((await source.getTemplateVersion(ref)).version, 2)
    assert.equal((await source.getAsset(assetRef)).size, bytes.length)
    assert.equal(calls, warmCalls)
    clock += CATALOG_TTL_MS + 1
    assert.equal((await source.listTemplatePage()).items.length, 2)
    await assert.rejects(() => source.getTemplateVersion({ templateId: 'missing', templateVersion: 2 }), { code: 'LOAD_FAILED' })
    clock += 25 * 60 * 60 * 1000
    await assert.rejects(() => source.listTemplatePage(), { code: 'LOAD_FAILED' })
    offline = false
    process.stdout.write('PASS 素材哈希读取、离线暖缓存、冷缓存和过期目录失败\n')

    disk.get('template:default@2').value.content_hash = '0'.repeat(64)
    source = build()
    const beforeRepair = calls
    assert.equal((await source.getTemplateVersion(ref)).version, 2)
    assert.equal(calls, beforeRepair + 1)
    await assert.rejects(() => source.getTemplateVersion({ ...ref, templateVersion: 99 }), { code: 'VERSION_NOT_FOUND' })
    definitions.set('default', envelope({ ...loaded[1], version: 9 }))
    await assert.rejects(() => source.getTemplateVersion(ref, { force: true }), { code: 'REFERENCE_MISMATCH' })
    definitions.set('default', { content: '{}', content_hash: '0'.repeat(64) })
    await assert.rejects(() => source.getTemplateVersion(ref, { force: true }), { code: 'INVALID_DEFINITION' })
    definitions.set('default', envelope(loaded[1]))
    asset = { ...asset, content_base64: Buffer.from('broken').toString('base64') }
    await assert.rejects(() => source.getAsset(assetRef, { force: true }), { code: 'INVALID_DEFINITION' })
    asset = { ...asset, content_base64: bytes.toString('base64') }
    assert.equal((await source.getAsset(assetRef, { force: true })).size, bytes.length)
    assert.throws(() => catalogItemSchema.parse({ ...catalog[0], schemaVersion: 1 }))
    assert.throws(() => catalogItemSchema.parse({ ...catalog[0], previews: [{ templateId: 'other', templateVersion: 2, example: catalog[0].defaultExample, appearance: loaded[1].appearanceDefaults, projectionReferenceDate: '2026-10-22', asset: assetRef }] }))
    process.stdout.write('PASS 损坏缓存删除重取、缺版本/引用/哈希拒绝、重试恢复、预览身份校验\n')

    let active = 0
    let maxActive = 0
    const limited = createTemplateTransport('https://templates.example.test', 'public-test-key', async (url: URL, options: { credentials?: string }) => {
      assert.ok(url.pathname.startsWith('/rest/v1/'))
      assert.equal(options.credentials, 'omit')
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise(resolve => setTimeout(resolve, 2))
      active--
      return new Response('[]')
    })
    await Promise.all(Array.from({ length: 20 }, (_, i) => limited(`resource-${i}`)))
    assert.equal(maxActive, 4)

    const pending: Array<(value: unknown) => void> = []
    const store = createTemplateResourceStore({ ...source, listTemplatePage: () => new Promise(resolve => pending.push(resolve)) })
    const first = store.getState().loadCatalog({ style: '简约' })
    const second = store.getState().loadCatalog({ style: '经典' })
    pending[1]({ items: [catalog[1]], nextOffset: null })
    await second
    pending[0]({ items: [catalog[0]], nextOffset: 12 })
    await first
    assert.equal(store.getState().catalog.data[0].templateId, 'classic-ribbon')
    process.stdout.write('PASS 网络并发限制为 4、快速筛选迟到响应隔离\n')
    const definitionJobs: Array<(value: unknown) => void> = []
    const isolatedStore = createTemplateResourceStore({ ...source, getTemplateVersion: () => new Promise(resolve => definitionJobs.push(resolve)) })
    const initialLoad = isolatedStore.getState().loadDefinition(ref)
    assert.equal(isolatedStore.getState().loadDefinition(ref), initialLoad)
    await Promise.resolve()
    const retryLoad = isolatedStore.getState().loadDefinition(ref, true)
    await Promise.resolve()
    definitionJobs[1](loaded[1])
    await retryLoad
    definitionJobs[0]({ ...loaded[1], version: 99 })
    await initialLoad
    assert.equal(isolatedStore.getState().definitions['default@2'].status, 'ready')
    assert.equal(isolatedStore.getState().definitions['default@2'].data.version, 2)

    const jobs: Array<(value: unknown) => void> = []
    const racing = createRemoteTemplateSource({ cache: { get: async () => undefined, set: async () => {}, delete: async () => {} }, transport: () => new Promise(resolve => jobs.push(resolve)) })
    const stale = racing.getTemplateVersion(ref)
    await new Promise(resolve => setTimeout(resolve, 0))
    const forced = racing.getTemplateVersion(ref, { force: true })
    await new Promise(resolve => setTimeout(resolve, 0))
    jobs[1]([envelope(loaded[1])])
    await forced
    jobs[0]([envelope({ ...loaded[1], appearanceDefaults: { ...loaded[1].appearanceDefaults, font: { ...loaded[1].appearanceDefaults.font, fontSize: 22 } } })])
    await stale
    assert.equal((await racing.getTemplateVersion(ref)).appearanceDefaults.font.fontSize, loaded[1].appearanceDefaults.font.fontSize)
    process.stdout.write('PASS 强制新请求完成后旧响应不能覆盖缓存\n')

    const retentionStore = createTemplateResourceStore({ ...source, getTemplateVersion: async (requested: { templateId: string, templateVersion: number }) => ({ ...loaded[1], templateId: requested.templateId }) })
    const release = retentionStore.getState().retainDefinition(ref)
    await retentionStore.getState().loadDefinition(ref)
    for (let i = 0; i < 140; i++)
      await retentionStore.getState().loadDefinition({ templateId: `test-${i}`, templateVersion: 2 })
    assert.ok(Object.keys(retentionStore.getState().definitions).length <= 96)
    assert.equal(retentionStore.getState().definitions['default@2'].status, 'ready')
    release()
    process.stdout.write('PASS Zustand资源数量有界且活动定义不被驱逐\n')

    const records = Array.from({ length: 160 }, (_, index) => ({ key: `record-${index}`, value: index, savedAt: index, expiresAt: Infinity }))
    const evicted = cacheEvictions(records, new Set(['record-0']))
    assert.equal(evicted.length, 32)
    assert.ok(!evicted.includes('record-0'))
    const large = [
      { key: 'active', value: 'x'.repeat(MAX_CACHE_BYTES / 2), savedAt: 0, expiresAt: Infinity },
      { key: 'old', value: 'x'.repeat(MAX_CACHE_BYTES / 2), savedAt: 1, expiresAt: Infinity },
      { key: 'new', value: 'x', savedAt: 2, expiresAt: Infinity },
    ]
    assert.deepEqual(cacheEvictions(large, new Set(['active'])), ['old'])
    const memoryCalls = new Map<string, number>()
    const memorySource = createRemoteTemplateSource({ cache: { get: async () => undefined, set: async () => {}, delete: async () => {} }, transport: async (_path: string, params: Record<string, string>) => {
      const id = params.template_id.slice(3)
      memoryCalls.set(id, (memoryCalls.get(id) ?? 0) + 1)
      return [envelope({ ...loaded[1], templateId: id })]
    } })
    const releaseMemory = memorySource.retainResource('template:default@2')
    await memorySource.getTemplateVersion(ref)
    for (let i = 0; i < 140; i++)
      await memorySource.getTemplateVersion({ templateId: `memory-${i}`, templateVersion: 2 })
    await memorySource.getTemplateVersion(ref)
    assert.equal(memoryCalls.get('default'), 1)
    await memorySource.getTemplateVersion({ templateId: 'memory-0', templateVersion: 2 })
    assert.equal(memoryCalls.get('memory-0'), 2)
    releaseMemory()
    process.stdout.write('PASS 内存128条LRU、持久缓存数量/32MiB预算及活动资源保留\n')

    const rows = Array.from({ length: 1000 }, (_, i) => ({ ...catalog[0], templateId: `sample-${i}`, previews: [] }))
    const offsets: number[] = []
    const bulk = createRemoteTemplateSource({ cache: { get: async () => undefined, set: async () => {}, delete: async () => {} }, transport: async (_path: string, params: Record<string, string>) => {
      offsets.push(Number(params.offset))
      assert.equal(params.select, 'metadata')
      assert.equal(params.limit, '13')
      return rows.slice(Number(params.offset), Number(params.offset) + 13).map(metadata => ({ metadata }))
    } })
    const start = await bulk.listTemplatePage()
    assert.equal(start.items.length, 12)
    assert.equal((await bulk.listTemplatePage({ offset: start.nextOffset })).items[0].templateId, 'sample-12')
    assert.deepEqual(offsets, [0, 12])
    process.stdout.write('PASS 千条目录按需读取 13 条摘要并返回 12 条，卡片不读取模板正文\n')
  }
  finally { await server.close() }
}
main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
