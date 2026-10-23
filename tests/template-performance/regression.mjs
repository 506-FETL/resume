import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import process from 'node:process'

const require = createRequire(import.meta.url)
const { chromium } = require(require.resolve('playwright', { paths: [process.env.PLAYWRIGHT_NODE_MODULES || process.cwd()] }))
const base = process.env.APP_URL || 'http://127.0.0.1:5174'
async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  const requests = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', (request) => {
    if (request.url().includes('/rest/v1/'))
      requests.push(request.url())
  })
  await page.addInitScript(() => {
    window.previewMetrics = { urls: 0, loading: [] }
    const create = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (...args) => {
      window.previewMetrics.urls++
      return create(...args)
    }
  })
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const readyDocument = () => page.locator('[role="dialog"] [data-resume-document][data-pagination-status="ready"]').waitFor({ timeout: 60000 })
  function monitor() {
    return page.evaluate(() => {
      window.previewMetrics.loading = []
      window.previewObserver?.disconnect()
      window.previewObserver = new MutationObserver(() => {
        const nodes = document.querySelectorAll('[data-preview-status="loading"], [data-preview-status="idle"]')
        if (nodes.length || document.body.textContent.includes('正在准备简历预览'))
          window.previewMetrics.loading.push(nodes.length)
      })
      window.previewObserver.observe(document.body, { childList: true, subtree: true, attributes: true })
    })
  }
  try {
    await page.goto(`${base}/template`)
    await page.locator('[data-preview-status="ready"]').first().waitFor({ timeout: 60000 })
    const cardCount = await page.locator('[data-template-preview-trigger]').count()
    assert(cardCount > 2)
    for (const trigger of await page.locator('[data-template-preview-trigger]').all()) {
      await trigger.scrollIntoViewIfNeeded()
      await trigger.locator('..').locator('[data-preview-status="ready"]').waitFor({ timeout: 60000 })
    }
    await page.mouse.move(0, 0)
    const before = { requests: requests.length, urls: await page.evaluate(() => window.previewMetrics.urls) }
    await monitor()
    for (let round = 0; round < 2; round++) {
      for (const label of ['创意', '全部风格', '简约', '全部风格', '双栏', '全部布局']) {
        await page.getByRole('button', { name: label, exact: true }).click()
        await settle()
      }
    }
    await page.waitForFunction(count => document.querySelectorAll('[data-template-preview-trigger]').length === count, cardCount)
    assert.equal(requests.length, before.requests, '已完整加载的目录筛选不应重复请求')
    assert.equal(await page.evaluate(() => window.previewMetrics.urls), before.urls, '筛选往返不应重新解码图片')
    assert.deepEqual(await page.evaluate(() => window.previewMetrics.loading), [], '缓存命中不应出现缩略图或完整预览加载占位')
    process.stdout.write(`PASS: ${cardCount} 套模板筛选往返，额外请求 0、重复图片解码 0、加载占位 0` + '\n')

    const trigger = page.locator('[data-template-preview-trigger="nature-green"]')
    // dispatchEvent 不触发 hover 预取，覆盖直接点击时用已加载首页承接真实冷启动。
    await trigger.dispatchEvent('click')
    await page.getByRole('dialog').waitFor()
    await readyDocument()
    const radio = page.getByRole('dialog').getByRole('radio')
    for (let index = 0; index < await radio.count(); index++) {
      await radio.nth(index).locator('..').click()
      await settle()
      await readyDocument()
    }
    await page.getByRole('button', { name: '返回列表', exact: true }).click()
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    const warm = { requests: requests.length, urls: await page.evaluate(() => window.previewMetrics.urls) }
    await monitor()
    for (let round = 0; round < 2; round++) {
      await trigger.click()
      await readyDocument()
      for (let index = 0; index < await radio.count(); index++) {
        await radio.nth(index).locator('..').click()
        await settle()
        await readyDocument()
      }
      await page.getByRole('button', { name: '返回列表', exact: true }).click()
      await page.getByRole('dialog').waitFor({ state: 'hidden' })
    }
    // 退出未结束便反向打开，保留 primitive 自身的交互动效。
    await trigger.click()
    await readyDocument()
    await page.getByRole('button', { name: '返回列表', exact: true }).dispatchEvent('click')
    await trigger.dispatchEvent('click')
    await readyDocument()
    assert.equal(requests.length, warm.requests, '暖预览应复用定义、示例与素材')
    assert.equal(await page.evaluate(() => window.previewMetrics.urls), warm.urls)
    assert.deepEqual(await page.evaluate(() => window.previewMetrics.loading), [])
    process.stdout.write('PASS: 预览两轮开关、示例往返、退出中重新打开，无重复请求/解码/加载占位' + '\n')
    await page.getByRole('button', { name: '返回列表', exact: true }).click()
    await page.getByRole('dialog').waitFor({ state: 'hidden' })

    // 在独立浏览器上下文的 IndexedDB 创建夹具，不写云端或用户正在使用的浏览器。
    const resumeId = await page.evaluate(async () => {
      const { resumeTemplateSource } = await import('/src/lib/resume-template/source/index.ts')
      const item = (await resumeTemplateSource.listTemplates()).find(item => item.templateId === 'nature-green')
      const { prepareTemplateResume } = await import('/src/lib/resume-template/create/prepare.ts')
      const prepared = await prepareTemplateResume({ template: { templateId: item.templateId, templateVersion: item.currentVersion }, example: item.defaultExample, mode: 'local', displayName: '名称回归：前端求职', description: '' }, resumeTemplateSource, { operationId: crypto.randomUUID(), ownerId: null })
      const { createOfflineResumeFromSnapshot } = await import('/src/lib/offline-resume-manager.ts')
      const result = await createOfflineResumeFromSnapshot(prepared)
      return result.resume_id
    })
    await page.goto(`${base}/resume`)
    const cardButton = page.locator(`[data-resume-edit-trigger="${resumeId}"]`)
    await cardButton.waitFor({ timeout: 30000 })
    const card = cardButton.locator('..')
    await card.getByRole('button', { name: '简历更多操作' }).click()
    await page.getByRole('menuitem', { name: '编辑信息' }).click()
    assert.equal(new URL(page.url()).pathname, '/resume')
    await page.getByRole('dialog').waitFor()
    await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    const disabledShare = card.getByRole('button', { name: '分享', exact: true })
    const bounds = await disabledShare.boundingBox()
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    assert.equal(new URL(page.url()).pathname, '/resume', '禁用操作不应穿透到编辑')
    await card.getByRole('button', { name: '派生针对性版本' }).click()
    await page.getByRole('dialog').waitFor()
    assert.equal(new URL(page.url()).pathname, '/resume')
    await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    await cardButton.click({ position: { x: 12, y: 110 } })
    await page.waitForURL('**/resume/editor')
    await page.getByRole('heading', { name: '名称回归：前端求职', exact: true }).waitFor({ timeout: 60000 })
    await page.reload()
    await page.getByRole('heading', { name: '名称回归：前端求职', exact: true }).waitFor({ timeout: 60000 })
    assert.equal(await page.getByRole('heading', { name: '林知夏', exact: true }).count(), 0)
    process.stdout.write('PASS: 卡片空白进入编辑、更多/派生/禁用分享独立；直接刷新标题使用简历名称' + '\n')
    await page.locator('[data-resume-document][data-pagination-status="ready"]').waitFor({ timeout: 60000 })
    await page.evaluate(() => {
      const create = document.createElement.bind(document)
      document.createElement = (...args) => {
        const element = create(...args)
        if (args[0] === 'iframe') {
          element.addEventListener('load', () => {
            element.contentWindow.print = () => {
              const doc = element.contentDocument
              window.printCapture = {
                html: doc.documentElement.outerHTML,
                pages: doc.querySelectorAll('[data-resume-page]').length,
                images: [...doc.images].map(image => ({ complete: image.complete, width: image.naturalWidth })),
              }
            }
          })
        }
        return element
      }
    })
    await page.getByRole('button', { name: '导出简历', exact: true }).click()
    await page.getByRole('button', { name: '导出 PDF', exact: true }).click()
    await page.waitForFunction(() => Boolean(window.printCapture), { timeout: 60000 })
    const printed = await page.evaluate(() => window.printCapture)
    assert(printed.pages > 0)
    assert(printed.images.length > 0 && printed.images.every(image => image.complete && image.width > 0), '真实导出入口必须读取到全部图片')
    const pdfPage = await context.newPage()
    await pdfPage.route(`${base}/__preview-print-test`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' }))
    await pdfPage.goto(`${base}/__preview-print-test`)
    await pdfPage.setContent(printed.html)
    await pdfPage.evaluate(async () => {
      await document.fonts.ready
      await Promise.all([...document.images].map(image => image.decode()))
    })
    for (const printBackground of [false, true]) {
      const pdf = await pdfPage.pdf({ format: 'A4', preferCSSPageSize: true, printBackground })
      assert(pdf.length > 10000)
      assert.equal(pdf.subarray(0, 4).toString(), '%PDF')
    }
    await pdfPage.close()
    process.stdout.write('PASS: 真实 PDF 导出入口通过排版校验，全部图片可读，背景开/关均生成 PDF\n')
    await page.goto(`${base}/resume`)
    await cardButton.waitFor()
    await cardButton.focus()
    await page.keyboard.press('Enter')
    await page.waitForURL('**/resume/editor')
    await page.getByRole('heading', { name: '名称回归：前端求职', exact: true }).waitFor()
    await page.goto(`${base}/template`)
    await page.locator('[data-preview-status="ready"]').first().waitFor({ timeout: 60000 })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const mobileTrigger = page.locator('[data-template-preview-trigger="classic-ribbon"]')
    for (let round = 0; round < 2; round++) {
      await mobileTrigger.click()
      await readyDocument()
      await page.getByRole('button', { name: '返回列表', exact: true }).click()
      await page.getByRole('dialog').waitFor({ state: 'hidden' })
    }
    process.stdout.write('PASS: 键盘 Enter 编辑、移动端减少动效模式两轮预览开关\n')
    assert.deepEqual(errors, [])
  }
  finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
