import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import process from 'node:process'

const require = createRequire(import.meta.url)
const { chromium } = require(require.resolve('playwright', { paths: [process.env.PLAYWRIGHT_NODE_MODULES || process.cwd()] }))
async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    const page = await browser.newPage()
    await page.goto(`${process.env.APP_URL || 'http://127.0.0.1:5174'}/template`)
    const catalog = await page.evaluate(async () => {
      const { createTemplateResourceStore } = await import('/src/store/resume-template/index.ts')
      const items = Array.from({ length: 35 }, (_, id) => ({ templateId: `${id}`, category: { style: id % 2 ? 'B' : 'A', layout: '单栏' } }))
      const calls = []
      let resolveSlow
      let fail = false
      const source = {
        async listTemplatePage(query = {}) {
          calls.push(query)
          if (fail)
            throw new Error('测试网络失败')
          if (query.style === 'slow')
            return new Promise((resolve) => { resolveSlow = resolve })
          const data = items.filter(item => !query.style || item.category.style === query.style)
          const offset = query.offset || 0
          return { items: data.slice(offset, offset + 12), nextOffset: offset + 12 < data.length ? offset + 12 : null }
        },
      }
      const store = createTemplateResourceStore(source)
      const check = (condition, message) => {
        if (!condition)
          throw new Error(message)
      }
      await store.getState().loadCatalog()
      check(store.getState().nextOffset === 12, '第一页仍应分页')
      await store.getState().loadCatalog({ style: 'A' })
      check(calls.length === 2, '不完整目录不能本地筛选')
      await store.getState().loadMore()
      check(store.getState().catalog.data.length === 18, '筛选分页追加完整')
      const count = calls.length
      const cached = store.getState().loadCatalog()
      check(store.getState().catalog.status === 'ready' && store.getState().catalog.data.length === 12, '缓存应同步恢复')
      await cached
      check(calls.length === count, '恢复目录不能重复请求')
      await store.getState().loadMore()
      await store.getState().loadMore()
      check(store.getState().catalog.data.length === 35 && store.getState().nextOffset === null, '完整目录不能丢失或重复')
      const completeCalls = calls.length
      await store.getState().loadCatalog({ style: 'B' })
      check(store.getState().catalog.data.length === 12 && store.getState().nextOffset === 12, '本地筛选也按 12 条分页')
      await store.getState().loadMore()
      check(store.getState().catalog.data.length === 17 && calls.length === completeCalls, '完整目录本地分页无需请求')
      const slow = store.getState().loadCatalog({ style: 'slow' }, true)
      check(store.getState().catalog.status === 'ready' && store.getState().refreshingCatalog, '冷筛选保留当前内容')
      await store.getState().loadCatalog({ style: 'A' })
      resolveSlow({ items: [], nextOffset: null })
      await slow
      check(store.getState().catalog.data.length === 12 && store.getState().catalogQuery.style === 'A', '迟到响应不得覆盖新筛选')
      fail = true
      await store.getState().loadCatalog({ style: 'B' }, true)
      check(store.getState().catalog.status === 'ready' && Boolean(store.getState().catalogRefreshError), '失败保留原内容并提供重试状态')
      fail = false
      await store.getState().loadCatalog({ style: 'B' }, true)
      check(!store.getState().catalogRefreshError && store.getState().catalogQuery.style === 'B', '失败后可重试恢复')
      return true
    })
    assert(catalog)
    process.stdout.write('PASS: 35 条目录分批加载、同步缓存命中、完整/不完整目录筛选、迟到响应和失败重试' + '\n')

    const images = await page.evaluate(async () => {
      const { createTemplateImageStore } = await import('/src/store/resume-template/images.ts')
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const blob = await new Promise(resolve => canvas.toBlob(resolve))
      let calls = 0
      let fail = true
      const revoked = new Set()
      const revoke = URL.revokeObjectURL
      URL.revokeObjectURL = (url) => {
        revoked.add(url)
        revoke(url)
      }
      const source = { async getAsset(asset) {
        calls++
        if (asset.hash === 'retry' && fail)
          throw new Error('失败')
        return blob
      } }
      const store = createTemplateImageStore(source)
      const ref = hash => ({ hash, mimeType: 'image/png', byteLength: blob.size, width: 1, height: 1 })
      const check = (condition, message) => {
        if (!condition)
          throw new Error(message)
      }
      try {
        const active = store.getState().retain('active')
        await Promise.all([store.getState().load(ref('active')), store.getState().load(ref('active'))])
        const url = store.getState().images.active.url
        check(calls === 1, '并发消费者共享一次下载和解码')
        await store.getState().load(ref('active'), true)
        check(calls === 1 && store.getState().images.active.url === url, '不可变哈希的已解码 URL 不应刷新')
        for (let i = 0; i < 70; i++) await store.getState().load(ref(`other-${i}`))
        check(Object.keys(store.getState().images).length <= 64, '空闲图片应有容量上限')
        check(!revoked.has(url) && store.getState().images.active.url === url, '活动 URL 不应被回收')
        active()
        for (let i = 70; i < 135; i++) await store.getState().load(ref(`other-${i}`))
        check(revoked.has(url), '释放后过期图片应回收')
        await store.getState().load(ref('retry'))
        check(store.getState().images.retry.status === 'error', '失败状态可见')
        fail = false
        await store.getState().load(ref('retry'), true)
        check(store.getState().images.retry.status === 'ready', '失败可以重试')
        const release = store.getState().retain('print', 1000)
        await store.getState().load(ref('print'))
        const printUrl = store.getState().images.print.url
        release()
        for (let i = 135; i < 200; i++) await store.getState().load(ref(`other-${i}`))
        check(!revoked.has(printUrl), '卸载后打印宽限期内 URL 必须存活')
        await new Promise(resolve => setTimeout(resolve, 1100))
        await store.getState().load(ref('last'))
        check(revoked.has(printUrl), '宽限期后才允许回收打印 URL')
        return true
      }
      finally { URL.revokeObjectURL = revoke }
    })
    assert(images)
    const metadataRequests = []
    await page.route('**/rest/v1/resume_config?**', async (route) => {
      metadataRequests.push(new URL(route.request().url()).searchParams.get('select'))
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ display_name: '云端简历名称', spacing: null, font: null, theme: null }) })
    })
    const name = await page.evaluate(async () => {
      const { default: supabase } = await import('/src/lib/supabase/client.ts')
      const original = supabase.auth.getSession
      supabase.auth.getSession = async () => ({ data: { session: { user: { id: '00000000-0000-4000-8000-000000000001' } } }, error: null })
      try {
        const { getCloudAppearanceSource } = await import('/src/store/resume/helpers/sync-service.ts')
        const result = await getCloudAppearanceSource('00000000-0000-4000-8000-000000000002')
        return { name: result.displayName, exists: result.resumeExists, metadataInAppearance: 'display_name' in result.appearance }
      }
      finally { supabase.auth.getSession = original }
    })
    assert.deepEqual(name, { name: '云端简历名称', exists: true, metadataInAppearance: false })
    assert.deepEqual(metadataRequests, ['spacing,font,theme,display_name'])
    process.stdout.write('PASS: 云端简历名称随现有外观请求读取，无额外请求且不混入正文外观数据\n')
    process.stdout.write('PASS: 图片并发去重、64 项回收、活动资源保护、失败重试、打印 URL 宽限期' + '\n')
  }
  finally { await browser.close() }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
