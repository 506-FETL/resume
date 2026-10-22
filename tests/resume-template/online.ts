import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { createServer, loadEnv } from 'vite'

async function main() {
  const env = loadEnv('development', '.', 'VITE_')
  assert.ok(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY, '线上核验需要当前已链接项目的公开配置')
  const server = await createServer({ server: { middlewareMode: true, watch: null, ws: false }, appType: 'custom' })
  const fixture = async (path: string) => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'))
  try {
    const { createRemoteTemplateSource } = await server.ssrLoadModule('/src/lib/resume-template/source/remote.ts')
    const { createTemplateTransport } = await server.ssrLoadModule('/src/lib/resume-template/source/transport.ts')
    const { catalogItemSchema } = await server.ssrLoadModule('/src/lib/resume-template/source/resource-schema.ts')
    const { parseTemplateDefinition } = await server.ssrLoadModule('/src/lib/resume-template/definition-schema.ts')
    const transport = createTemplateTransport(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY)
    const source = createRemoteTemplateSource({ transport, cache: { get: async () => undefined, set: async () => {}, delete: async () => {} } })
    const catalog = (await fixture('template-resources/catalog.json')).map((item: unknown) => catalogItemSchema.parse(item))
    const page = await source.listTemplatePage()
    const checkedAssets = new Set<string>()
    const checkAsset = async (ref: { hash: string, byteLength: number, mimeType: string }) => {
      if (checkedAssets.has(ref.hash))
        return
      const blob = await source.getAsset(ref)
      const bytes = Buffer.from(await blob.arrayBuffer())
      assert.equal(blob.type, ref.mimeType)
      assert.equal(bytes.length, ref.byteLength)
      assert.equal(createHash('sha256').update(bytes).digest('hex'), ref.hash)
      checkedAssets.add(ref.hash)
    }
    for (const item of catalog) {
      assert.deepEqual(page.items.find((remote: { templateId: string }) => remote.templateId === item.templateId), item)
      const ref = { templateId: item.templateId, templateVersion: item.currentVersion }
      const local = parseTemplateDefinition(await fixture(`template-resources/${item.templateId}/v${item.currentVersion}.json`))
      assert.deepEqual(await source.getTemplateVersion(ref), local)
      const row = (await transport('official_resume_template_versions', { select: 'content,content_hash,published_at', template_id: `eq.${ref.templateId}`, version: `eq.${ref.templateVersion}` }))[0]
      assert.ok(row.published_at)
      assert.equal(row.content_hash, createHash('sha256').update(row.content).digest('hex'))
      assert.deepEqual(JSON.parse(row.content), local)
      for (const example of item.examples)
        assert.deepEqual(await source.getExample(example), await fixture(`template-resources/examples/${example.exampleId}/v${example.version}.json`))
      for (const asset of local.assets)
        await checkAsset({ hash: asset.sha256, byteLength: asset.bytes, mimeType: asset.mimeType, width: asset.width, height: asset.height })
      for (const preview of item.previews) {
        const example = await source.getExample(preview.example)
        assert.equal(preview.templateId, item.templateId)
        assert.equal(preview.templateVersion, item.currentVersion)
        assert.deepEqual(preview.appearance, local.appearanceDefaults)
        assert.equal(preview.projectionReferenceDate, example.projectionReferenceDate)
        await checkAsset(preview.asset)
      }
    }
    const classic = catalog.find((item: { templateId: string }) => item.templateId === 'classic-ribbon')
    assert.equal((await source.listTemplatePage({ style: classic.category.style })).items[0].templateId, 'classic-ribbon')
    assert.ok((await source.getCatalogFacets()).layouts.includes(classic.category.layout))
    await assert.rejects(() => source.getTemplateVersion({ templateId: 'default', templateVersion: 2147483647 }), { code: 'VERSION_NOT_FOUND' })
    await assert.rejects(() => source.getAsset({ hash: '0'.repeat(64), byteLength: 1, mimeType: 'image/png', width: 1, height: 1 }), { code: 'VERSION_NOT_FOUND' })
    await assert.rejects(() => source.getTemplateVersion({ templateId: 'default', templateVersion: 1 }), { code: 'UNSUPPORTED_CAPABILITY' })
    for (const table of ['official_resume_template_versions', 'official_resume_example_versions', 'official_resume_assets']) {
      const drafts = await transport(table, { select: 'published_at', published_at: 'is.null', limit: '1' })
      assert.deepEqual(drafts, [], `公开API不能读取草稿: ${table}`)
    }
    // 不可能匹配的 ID；核验公开角色缺少写权限，不修改任何记录。
    const denial = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/official_resume_template_catalog?template_id=eq.__permission_probe_never_matches__`, {
      method: 'PATCH',
      headers: { 'apikey': env.VITE_SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ listed: false }),
    })
    assert.ok([401, 403].includes(denial.status), `Public write must be denied, received ${denial.status}`)
    process.stdout.write(`PASS 线上schema2目录、两模板/两示例、${checkedAssets.size}份哈希素材、预览身份、草稿隔离、旧协议拒绝及禁止写入（${denial.status}）\n`)
  }
  finally { await server.close() }
}
main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
