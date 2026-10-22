import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import process from 'node:process'
import { createServer, loadEnv } from 'vite'

async function main() {
  const env = loadEnv('development', '.', 'VITE_')
  const server = await createServer({ server: { middlewareMode: true, watch: null, ws: false }, appType: 'custom' })
  try {
    const { localTemplateSource } = await server.ssrLoadModule('/src/lib/resume-template/source/local.ts')
    const { createRemoteTemplateSource } = await server.ssrLoadModule('/src/lib/resume-template/source/remote.ts')
    const { createTemplateTransport } = await server.ssrLoadModule('/src/lib/resume-template/source/transport.ts')
    const transport = createTemplateTransport(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY)
    const source = createRemoteTemplateSource({ transport, cache: { get: async () => undefined, set: async () => {}, delete: async () => {} } })
    const catalog = await localTemplateSource.listTemplates()
    const page = await source.listTemplatePage()
    for (const item of catalog) {
      assert.deepEqual(page.items.find((remote: { templateId: string }) => remote.templateId === item.templateId), item)
      const ref = { templateId: item.templateId, templateVersion: item.currentVersion }
      const local = await localTemplateSource.getTemplateVersion(ref)
      assert.deepEqual(await source.getTemplateVersion(ref), local)
      const row = (await transport('official_resume_template_versions', { select: 'content_hash', template_id: `eq.${ref.templateId}`, version: `eq.${ref.templateVersion}` }))[0]
      assert.equal(row.content_hash, createHash('sha256').update(JSON.stringify(local)).digest('hex'))
      for (const example of item.examples)
        assert.deepEqual(await source.getExample(example), await localTemplateSource.getExample(example))
    }
    assert.equal((await source.listTemplatePage({ style: '经典' })).items[0].templateId, 'classic-ribbon')
    assert.ok((await source.getCatalogFacets()).layouts.includes('单栏'))
    await assert.rejects(() => source.getTemplateVersion({ templateId: 'default', templateVersion: 2147483647 }), { code: 'VERSION_NOT_FOUND' })
    // 不可能匹配的 ID；即使权限意外放开，也不会改变任何现有记录。
    const denial = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/official_resume_template_catalog?template_id=eq.__permission_probe_never_matches__`, {
      method: 'PATCH',
      headers: { 'apikey': env.VITE_SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ listed: false }),
    })
    assert.ok([401, 403].includes(denial.status), `Public write must be denied, received ${denial.status}`)
    process.stdout.write(`PASS 线上目录、两套模板／两份示例与迁移输入一致；哈希、筛选、缺版本及禁止写入（${denial.status}）` + '\n')
  }
  finally {
    await server.close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
