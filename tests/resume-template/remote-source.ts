import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import process from 'node:process'
import { createServer } from 'vite'

async function main() {
  const server = await createServer({ server: { middlewareMode: true, watch: null, ws: false }, appType: 'custom' })
  function envelope(value: unknown) {
    const content = JSON.stringify(value)
    return { content, content_hash: createHash('sha256').update(content).digest('hex') }
  }
  try {
    const { createRemoteTemplateSource, CATALOG_TTL_MS } = await server.ssrLoadModule('/src/lib/resume-template/source/remote.ts')
    const { createTemplateTransport } = await server.ssrLoadModule('/src/lib/resume-template/source/transport.ts')
    const { TemplateResolutionError } = await server.ssrLoadModule('/src/lib/resume-template/definition-schema.ts')
    const { localTemplateSource } = await server.ssrLoadModule('/src/lib/resume-template/source/local.ts')
    const { prepareTemplateResume } = await server.ssrLoadModule('/src/lib/resume-template/create/prepare.ts')
    const { createTemplateResourceStore } = await server.ssrLoadModule('/src/store/resume-template/index.ts')
    const catalog = await localTemplateSource.listTemplates()
    const definitions = new Map()
    const examples = new Map()
    for (const item of catalog) {
      definitions.set(item.templateId, envelope(await localTemplateSource.getTemplateVersion({ templateId: item.templateId, templateVersion: 1 })))
      for (const ref of item.examples)
        examples.set(ref.exampleId, envelope(await localTemplateSource.getExample(ref)))
    }
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
      await new Promise(resolve => setTimeout(resolve, 5))
      if (offline)
        throw new TemplateResolutionError('LOAD_FAILED', 'offline')
      if (path.endsWith('_catalog'))
        return catalog.filter((item: { category: { style: string } }) => !params.style || `eq.${item.category.style}` === params.style).slice(Number(params.offset), Number(params.offset) + Number(params.limit)).map((metadata: unknown) => ({ metadata }))
      if (path.startsWith('rpc/'))
        return { styles: ['简约', '经典'], layouts: ['单栏'] }
      const values = path.endsWith('_template_versions') ? definitions : examples
      const id = (params.template_id ?? params.example_id).slice(3)
      return params.version === 'eq.1' && values.has(id) ? [structuredClone(values.get(id))] : []
    }
    const build = () => createRemoteTemplateSource({ transport, cache, now: () => clock })
    let source = build()
    const ref = { templateId: 'default', templateVersion: 1 }
    const loaded = await Promise.all(Array.from({ length: 20 }, () => source.getTemplateVersion(ref)))
    assert.equal(calls, 1)
    loaded[0].version = 99
    assert.equal(loaded[1].version, 1)
    assert.equal((await source.getTemplateVersion(ref)).version, 1)
    assert.equal(calls, 1)
    source = build()
    assert.equal((await source.getTemplateVersion(ref)).version, 1)
    assert.equal(calls, 1)
    process.stdout.write('PASS 20 路请求合并为 1 次；返回值隔离；热读和刷新后缓存零请求' + '\n')

    const page = await source.listTemplatePage()
    assert.equal(page.items.length, 2)
    assert.equal(page.nextOffset, null)
    await source.getExample(catalog[0].defaultExample)
    const beforeCreate = calls
    await prepareTemplateResume({ template: ref, example: catalog[0].defaultExample, mode: 'local', displayName: '缓存验证', description: '' }, source, { operationId: crypto.randomUUID(), ownerId: null })
    assert.equal(calls, beforeCreate)
    assert.equal((await source.listTemplatePage({ style: '经典' })).items[0].templateId, 'classic-ribbon')
    process.stdout.write('PASS 目录元数据、服务端筛选；预览到创建不重复读取' + '\n')

    offline = true
    source = build()
    assert.equal((await source.getTemplateVersion(ref)).version, 1)
    assert.equal((await source.getExample(catalog[0].defaultExample)).exampleId, 'graduate')
    assert.equal((await source.listTemplatePage()).items.length, 2)
    clock += CATALOG_TTL_MS + 1
    assert.equal((await source.listTemplatePage()).items.length, 2)
    await assert.rejects(() => source.getTemplateVersion({ templateId: 'missing', templateVersion: 1 }), { code: 'LOAD_FAILED' })
    clock += 25 * 60 * 60 * 1000
    await assert.rejects(() => source.listTemplatePage(), { code: 'LOAD_FAILED' })
    assert.equal((await source.getTemplateVersion(ref)).version, 1)
    offline = false
    assert.equal((await source.listTemplatePage()).items.length, 2)
    process.stdout.write('PASS 离线精确版本复用、目录过期重取／有限期离线复用、失败可重试' + '\n')

    disk.get('template:default@1').value.content_hash = '0'.repeat(64)
    source = build()
    const beforeRepair = calls
    assert.equal((await source.getTemplateVersion(ref)).version, 1)
    assert.equal(calls, beforeRepair + 1)
    await assert.rejects(() => source.getTemplateVersion({ ...ref, templateVersion: 2 }), { code: 'VERSION_NOT_FOUND' })
    definitions.set('default', envelope({ ...loaded[1], version: 9 }))
    await assert.rejects(() => source.getTemplateVersion(ref, { force: true }), { code: 'REFERENCE_MISMATCH' })
    definitions.set('default', { content: '{}', content_hash: '0'.repeat(64) })
    await assert.rejects(() => source.getTemplateVersion(ref, { force: true }), { code: 'INVALID_DEFINITION' })
    definitions.set('default', envelope(loaded[1]))
    assert.equal((await source.getTemplateVersion(ref, { force: true })).version, 1)
    process.stdout.write('PASS 缓存损坏修复、缺版本／引用冲突／哈希错误拒绝、强制重试恢复' + '\n')

    let active = 0
    let maxActive = 0
    const limited = createTemplateTransport('https://templates.example.test', 'public-test-key', async (url: URL, options: { credentials?: string }) => {
      assert.ok(url.pathname.startsWith('/rest/v1/'))
      assert.equal(options.credentials, 'omit')
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise(resolve => setTimeout(resolve, 5))
      active--
      return new Response('[]')
    })
    await Promise.all(Array.from({ length: 20 }, (_, i) => limited(`resource-${i}`)))
    assert.equal(maxActive, 4)
    process.stdout.write('PASS 网络并发上限为 4，无用户认证依赖' + '\n')

    const pending: Array<(value: unknown) => void> = []
    const store = createTemplateResourceStore({ ...localTemplateSource, listTemplatePage: () => new Promise(resolve => pending.push(resolve)) })
    const first = store.getState().loadCatalog({ style: '简约' })
    const second = store.getState().loadCatalog({ style: '经典' })
    pending[1]({ items: [catalog[1]], nextOffset: null })
    await second
    pending[0]({ items: [catalog[0]], nextOffset: 12 })
    await first
    assert.equal(store.getState().catalog.data[0].templateId, 'classic-ribbon')
    assert.equal(store.getState().nextOffset, null)
    process.stdout.write('PASS 快速切换筛选不会被旧请求覆盖' + '\n')

    const rows = Array.from({ length: 1000 }, (_, i) => ({ ...catalog[0], templateId: `sample-${i}` }))
    const offsets: number[] = []
    const bulk = createRemoteTemplateSource({ cache: { get: async () => undefined, set: async () => {}, delete: async () => {} }, transport: async (_path: string, params: Record<string, string>) => {
      offsets.push(Number(params.offset))
      assert.equal(params.select, 'metadata')
      assert.equal(params.limit, '13')
      return rows.slice(Number(params.offset), Number(params.offset) + 13).map(metadata => ({ metadata }))
    } })
    const start = await bulk.listTemplatePage()
    assert.equal(start.items.length, 12)
    assert.equal(start.nextOffset, 12)
    assert.equal((await bulk.listTemplatePage({ offset: start.nextOffset })).items[0].templateId, 'sample-12')
    assert.deepEqual(offsets, [0, 12])
    process.stdout.write('PASS 千条目录只按页读取 13 条摘要，返回 12 条，不下载正文或配置' + '\n')
  }
  finally {
    await server.close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
