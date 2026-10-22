import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import process from 'node:process'

async function main() {
  const require = createRequire(import.meta.url)
  const { chromium } = require(require.resolve('playwright', { paths: [process.env.PLAYWRIGHT_NODE_MODULES || '/Users/shemingcong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }))
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 1400, height: 1500 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const base = process.env.RESUME_TEST_URL || 'http://127.0.0.1:5174'
  const report = []
  const reportName = process.env.EDGE_STRICT ? 'edge-cases-strict-report.json' : 'edge-cases-report.json'
  const navigate = url => page.goto(process.env.EDGE_STRICT ? `${url}&strict` : url)
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await mkdir('tests/resume-template/artifacts', { recursive: true })

  async function settle() {
    await page.waitForFunction(() => ['ready', 'error'].includes(window.resumeState?.status), undefined, { timeout: 30000 })
    return page.evaluate(() => window.resumeState)
  }
  async function updateFixture(change, arg) {
    const snapshot = await page.evaluate(() => {
      window.edgePriorState = window.resumeState
      return structuredClone(window.resumeFixture)
    })
    change(snapshot, arg)
    await page.evaluate(snapshot => window.setResumeFixture(snapshot), snapshot)
    await page.waitForFunction(() => window.resumeState !== window.edgePriorState, undefined, { timeout: 30000 })
    return settle()
  }
  async function updateDefinition(definition) {
    await page.evaluate((definition) => {
      window.edgePriorState = window.resumeState
      window.setResumeDefinition(definition)
    }, definition)
    await page.waitForFunction(() => window.resumeState !== window.edgePriorState, undefined, { timeout: 30000 })
    return settle()
  }
  async function check(name, run) {
    if (process.env.EDGE_CASES_FILTER && !name.includes(process.env.EDGE_CASES_FILTER))
      return
    try {
      const result = await run()
      report.push({ name, status: 'passed', ...result })
      console.warn(`PASS ${name}`)
    }
    catch (error) {
      const diagnostics = await page.evaluate(() => ({ state: window.resumeState, markers: [...document.querySelectorAll('[data-resume-runtime-ready]')].map(node => ({ ready: node.dataset.resumeRuntimeReady, error: node.dataset.resumeRuntimeError, measurement: Boolean(node.closest('[data-resume-measurement-source]')) })) })).catch(() => null)
      report.push({ name, status: 'failed', error: error.stack, diagnostics })
      console.error(`FAIL ${name}: ${error.message}`)
      await page.screenshot({ path: `tests/resume-template/artifacts/edge-${name.replace(/[^a-z0-9-]/gi, '-')}.png`, fullPage: true }).catch(() => {})
    }
  }
  async function bodyGeometry() {
    return page.evaluate(() => {
      const source = document.querySelector('[data-resume-source]')
      const bounds = source.getBoundingClientRect()
      const overflow = []
      const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        const text = walker.currentNode
        if (!text.textContent.trim() || text.parentElement.closest('[data-resume-decoration]'))
          continue
        const range = document.createRange()
        range.selectNodeContents(text)
        for (const rect of range.getClientRects()) {
          if (rect.left < bounds.left - 1 || rect.right > bounds.right + 1) {
            overflow.push({ text: text.textContent.slice(0, 80), left: rect.left - bounds.left, right: rect.right - bounds.right })
            break
          }
        }
      }
      const keys = [...source.querySelectorAll('[data-comment-node-key]')].map(node => node.dataset.commentNodeKey)
      return { width: bounds.width, scrollWidth: source.scrollWidth, overflow, keys, text: source.textContent }
    })
  }

  try {
    for (const template of ['default', 'classic-ribbon']) {
      for (const [fontSize, margin] of [[24, 100], [10, 0]]) {
        await check(`${template}-long-fields-size${fontSize}-margin${margin}`, async () => {
          await navigate(`${base}/tests/resume-template/harness.html?template=${template}`)
          assert.equal((await settle()).status, 'ready')
          const state = await updateFixture((snapshot, { fontSize, margin }) => {
            snapshot.font.fontSize = fontSize
            snapshot.spacing.pageMargin = margin
            snapshot.basics.name = '极长姓名中英文混排 LongName'.repeat(10)
            snapshot.basics.email = `${'extremely-long-email-fragment-'.repeat(15)}@example.test`
            snapshot.work_experience.items[0].companyName = '超长公司名称 International Enterprise Research And Development '.repeat(15)
            snapshot.work_experience.items[0].position = '复杂领域平台研发工程师及负责人 Senior Engineer '.repeat(12)
            snapshot.work_experience.items[0].workInfo = '<p>LONG-FIELD-END 保留末尾内容。</p>'
          }, { fontSize, margin })
          if (state.status === 'error') {
            assert.ok(state.error && /分页|高度|边界|排版|拆分|尺寸/.test(state.error), state.error)
            return { outcome: 'explicit-layout-error', error: state.error }
          }
          assert.equal(state.status, 'ready', state.error)
          const geometry = await bodyGeometry()
          assert.equal(geometry.overflow.length, 0, JSON.stringify(geometry.overflow.slice(0, 4)))
          assert.ok(geometry.text.includes('LONG-FIELD-END'))
          assert.ok(state.signature.pages.length >= 1)
          const splitLines = await page.evaluate(() => {
            const clips = [...document.querySelectorAll('[data-resume-page-clip]')]
            const source = document.querySelector('[data-resume-source]')
            const top = source.getBoundingClientRect().top
            const heights = clips.map(clip => clip.getBoundingClientRect().height)
            const boundaries = heights.slice(0, -1).map((_, index) => heights.slice(0, index + 1).reduce((sum, h) => sum + h, 0))
            const invalid = []
            const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT)
            while (walker.nextNode()) {
              const text = walker.currentNode
              if (!text.textContent.trim() || text.parentElement.closest('[data-resume-decoration]'))
                continue
              const range = document.createRange()
              range.selectNodeContents(text)
              for (const rect of range.getClientRects()) {
                for (const boundary of boundaries) {
                  if (rect.top - top + 0.5 < boundary && rect.bottom - top - 0.5 > boundary)
                    invalid.push({ text: text.textContent.slice(0, 60), boundary, top: rect.top - top, bottom: rect.bottom - top })
                }
              }
            }
            return invalid
          })
          assert.equal(splitLines.length, 0, JSON.stringify(splitLines.slice(0, 4)))
          return { pages: state.signature.pages.length, viewportWidth: geometry.width, textRangesWithinViewport: true, pageBreaksAvoidTextRanges: true }
        })
      }
      await check(`${template}-hidden-and-empty`, async () => {
        await navigate(`${base}/tests/resume-template/harness.html?template=${template}`)
        await settle()
        const state = await updateFixture((snapshot) => {
          snapshot.visibility.work_experience = true
          snapshot.visibility.self_evaluation = false
          snapshot.self_evaluation.content = '<p><br></p>'
          snapshot.skill_specialty = { skills: [], description: '<p> </p>' }
          snapshot.honors_certificates = { certificates: [], description: '' }
          snapshot.hobbies = { hobbies: [], description: '<p><br></p>' }
        })
        assert.equal(state.status, 'ready', state.error)
        const result = await page.evaluate(() => {
          const root = document.querySelector('[data-resume-source]')
          const sectionKeys = [...root.querySelectorAll('[data-section]')].map(node => node.dataset.section)
          const empty = [...root.querySelectorAll('[data-layout-node]')].filter(node => !node.textContent.trim() && !node.querySelector('svg,img,[data-resume-decoration]')).map(node => node.dataset.layoutNode)
          return { sectionKeys, empty }
        })
        for (const section of ['work_experience', 'self_evaluation', 'skill_specialty', 'honors_certificates', 'hobbies']) assert.ok(!result.sectionKeys.includes(section), section)
        assert.deepEqual(result.empty, [])
        return result
      })
    }

    await check('dynamic-third-definition', async () => {
      await navigate(`${base}/tests/resume-template/harness.html?template=default`)
      await settle()
      const original = await page.evaluate(() => ({ definition: structuredClone(window.resumeDefinition), keys: [...document.querySelector('[data-resume-source]').querySelectorAll('[data-comment-node-key]')].map(node => node.dataset.commentNodeKey).sort() }))
      const third = original.definition
      third.templateId = 'edge-copper-ledger'
      third.tokens = { primary: '#883399', accent: '#b48238' }
      third.capabilities = ['flow', 'local-grid', 'vector-shapes']
      third.styles.edgeHeading = { color: { token: 'primary' }, fontSize: { token: 'fontSize' }, borderBottomWidth: 3, borderColor: { token: 'accent' }, gap: 8 }
      third.styles.edgeDot = { width: 10, height: 10 }
      third.document = [{ id: 'edge-document', type: 'box', layout: 'stack', style: 'document', children: [
        { id: 'edge-fixed-heading', type: 'text', text: 'DYNAMIC THIRD TEMPLATE', style: 'edgeHeading' },
        { id: 'edge-profile', type: 'box', layout: 'stack', sectionTarget: 'basics', children: [{ id: 'edge-profile-fields', type: 'repeat', source: 'profile.fields', layout: 'grid', style: 'edgeHeading', children: [{ id: 'edge-profile-field', type: 'field', binding: 'item', showLabel: true }] }] },
        { id: 'edge-sections', type: 'sections' },
      ] }]
      third.section = [{ id: 'edge-heading-row', type: 'box', layout: 'row', style: 'edgeHeading', atomic: true, children: [
        { id: 'edge-heading-dot', type: 'shape', style: 'edgeDot', viewBox: [0, 0, 10, 10], shapes: [{ kind: 'circle', cx: 5, cy: 5, radius: 4, fill: { token: 'accent' } }] },
        { id: 'edge-heading-text', type: 'text', binding: 'section.title' },
      ] }, { id: 'edge-content', type: 'blocks' }]
      third.contentByKind.experience = [{ id: 'edge-experience-list', type: 'repeat', source: 'block.items', layout: 'stack', style: 'entries', children: [{ id: 'edge-experience', type: 'box', layout: 'stack', children: [
        { id: 'edge-experience-name', type: 'field', binding: 'item.title', style: 'edgeHeading' },
        { id: 'edge-experience-position', type: 'field', binding: 'item.subtitle' },
        { id: 'edge-experience-date', type: 'field', binding: 'item.duration' },
        { id: 'edge-experience-description', type: 'richText', binding: 'item.description' },
      ] }] }]
      const state = await updateDefinition(third)
      assert.equal(state.status, 'ready', state.error)
      const geometry = await bodyGeometry()
      assert.ok(geometry.text.includes('DYNAMIC THIRD TEMPLATE'))
      assert.deepEqual([...geometry.keys].sort(), original.keys)
      const color = await page.locator('[data-resume-source] [data-layout-node="edge-fixed-heading"]').evaluate(node => getComputedStyle(node).color)
      assert.equal(color, 'rgb(136, 51, 153)')
      assert.equal(geometry.overflow.length, 0, JSON.stringify(geometry.overflow.slice(0, 3)))
      return { pages: state.signature.pages.length, primaryCommentKeys: geometry.keys.length, templateId: third.templateId, color }
    })

    await check('simultaneous-instance-isolation', async () => {
      await navigate(`${base}/tests/resume-template/harness.html?template=default`)
      await settle()
      await page.evaluate(async () => {
        const { mountEdgeInstances } = await import('/tests/resume-template/edge-instances.tsx')
        mountEdgeInstances(window.resumeFixture, window.resumeDefinition, '2026-10-21')
      })
      await page.waitForFunction(() => document.querySelectorAll('#edge-instances [data-resume-runtime-ready="true"]').length === 2)
      const values = await page.evaluate(() => ['left', 'right'].map((side) => {
        const root = document.querySelector(`[data-edge-instance="${side}"]`)
        const node = root.querySelector('[data-layout-node="profile-name"]')
        return { side, color: getComputedStyle(node).color, size: getComputedStyle(node).fontSize, nodeKey: node.querySelector('[data-comment-node-key]').dataset.commentNodeKey }
      }))
      assert.equal(values[0].color, 'rgb(170, 0, 0)')
      assert.equal(values[1].color, 'rgb(0, 68, 170)')
      assert.equal(values[0].size, '18px')
      assert.equal(values[1].size, '30px')
      assert.equal(values[0].nodeKey, values[1].nodeKey)
      return { values }
    })

    await check('required-asset-failure-and-retry', async () => {
      const png = await readFile('template-resources/previews/default-frontend.png')
      const hash = createHash('sha256').update(png).digest('hex')
      const width = png.readUInt32BE(16)
      const height = png.readUInt32BE(20)
      const cachedPng = await readFile('template-resources/previews/classic-ribbon-frontend.png')
      const cachedHash = createHash('sha256').update(cachedPng).digest('hex')
      const cachedWidth = cachedPng.readUInt32BE(16)
      const cachedHeight = cachedPng.readUInt32BE(20)
      let failAsset = true
      let offlineAssets = false
      let offlineRequests = 0
      let requests = 0
      await context.route('**/rest/v1/official_resume_assets?**', async (route) => {
        const url = new URL(route.request().url())
        const requestedHash = url.searchParams.get('content_hash')?.slice(3)
        if (![hash, cachedHash].includes(requestedHash))
          return route.continue()
        if (offlineAssets) {
          offlineRequests++
          return route.abort('internetdisconnected')
        }
        requests++
        const bytes = requestedHash === hash ? png : cachedPng
        const assetWidth = requestedHash === hash ? width : cachedWidth
        const assetHeight = requestedHash === hash ? height : cachedHeight
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(requestedHash === hash && failAsset ? [] : [{ content_hash: requestedHash, mime_type: 'image/png', byte_size: bytes.byteLength, width: assetWidth, height: assetHeight, content_base64: bytes.toString('base64') }]) })
      })
      await navigate(`${base}/tests/resume-template/harness.html?template=default`)
      await settle()
      const definition = await page.evaluate(() => structuredClone(window.resumeDefinition))
      definition.assets = [{ id: 'edge-required-image', sha256: hash, mimeType: 'image/png', bytes: png.byteLength, width, height, required: true }]
      definition.capabilities.push('images')
      definition.styles.edgeImage = { width: 100, height: 140 }
      definition.document.push({ id: 'edge-required-image-node', type: 'image', asset: 'edge-required-image', alt: '测试必需资源', style: 'edgeImage' })
      const cachedDefinition = structuredClone(definition)
      cachedDefinition.templateId = 'edge-cached-image-template'
      cachedDefinition.assets = [{ id: 'edge-required-image', sha256: cachedHash, mimeType: 'image/png', bytes: cachedPng.byteLength, width: cachedWidth, height: cachedHeight, required: true }]
      assert.equal((await updateDefinition(cachedDefinition)).status, 'ready')
      const failed = await updateDefinition(definition)
      assert.equal(failed.status, 'error')
      assert.ok(failed.error)
      assert.equal(await page.locator('[data-resume-source] [data-resume-runtime-ready="true"]').count(), 0)
      const loadingMarkers = await page.locator('[data-edge-asset-gate]').count()
      assert.equal(await page.locator('[data-resume-document]').count(), 0)
      await page.locator('#print').click()
      assert.equal(await page.locator('iframe').count(), 0, '资源失败时不得进入打印')
      failAsset = false
      const retry = page.locator('[data-edge-asset-gate] button').filter({ hasText: '重试' }).first()
      await retry.click()
      // 使用用户可达的重试入口；隐藏测量副本不能要求用户手动点击。
      await page.waitForFunction(() => window.resumeState?.status === 'ready', undefined, { timeout: 10000 })
      const state = await settle()
      assert.equal(state.status, 'ready', state.error)
      assert.ok(requests >= 2)
      const urls = await page.locator('img[data-layout-node="edge-required-image-node"]').evaluateAll(nodes => nodes.map(node => node.src))
      assert.ok(urls.length >= 2)
      assert.equal(new Set(urls).size, 1, '测量和展示必须共用素材 URL')
      await page.evaluate(() => {
        window.edgeAssetPrintCaptured = false
        const capture = () => {
          for (const frame of document.querySelectorAll('iframe')) {
            try {
              frame.contentWindow.print = () => {
                const image = frame.contentDocument.querySelector('img[data-layout-node="edge-required-image-node"]')
                window.edgeAssetPrintCaptured = Boolean(image?.complete && image.naturalWidth > 0)
              }
            }
            catch {}
          }
        }
        new MutationObserver(capture).observe(document.body, { childList: true, subtree: true })
      })
      await page.locator('#print').click()
      await page.waitForFunction(() => window.edgeAssetPrintCaptured, undefined, { timeout: 20000 })
      offlineAssets = true
      await context.setOffline(true)
      try {
        assert.equal((await updateDefinition(cachedDefinition)).status, 'ready', 'cached alternative must work offline after retry')
        assert.equal((await updateDefinition(definition)).status, 'ready', 'previously retried definition must work offline')
        assert.equal(offlineRequests, 0, 'ordinary template switching must not force fetch')
      }
      finally {
        await context.setOffline(false)
      }
      return { requests, loadingMarkers, retryRestoredReady: true, printBlockedOnFailure: true, sharedAssetUrl: true, printReadyAfterRetry: true, cachedAlternativeOfflineReady: true, retriedDefinitionOfflineReady: true, offlineRequests }
    })
    assert.equal(pageErrors.length, 0, JSON.stringify(pageErrors))
  }
  finally {
    await writeFile(`tests/resume-template/artifacts/${reportName}`, JSON.stringify({ report, pageErrors }, null, 2))
    await browser.close()
  }
  if (report.some(item => item.status === 'failed'))
    process.exitCode = 1
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
