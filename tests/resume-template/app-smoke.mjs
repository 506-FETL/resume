/* eslint-disable antfu/no-top-level-await, no-console */
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import process from 'node:process'

const require = createRequire(import.meta.url)
const { chromium } = require(require.resolve('playwright', { paths: [process.env.PLAYWRIGHT_NODE_MODULES || process.cwd()] }))
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } })
const base = process.env.RESUME_TEST_URL || 'http://127.0.0.1:5174'
try {
  await page.goto(`${base}/template`)
  await page.getByText('经典蓝金模板', { exact: true }).first().waitFor()
  await page.waitForFunction(() => document.querySelectorAll('img[src^="blob:"]').length >= 2)
  assert.equal(await page.locator('[data-resume-measurement-source]').count(), 0, '目录不能运行全文测量')
  await page.screenshot({ path: 'tests/resume-template/artifacts/catalog.png' })
  await page.getByRole('button', { name: '预览经典蓝金模板', exact: true }).click()
  await page.locator('[data-pagination-status=ready]').waitFor()
  await page.getByRole('button', { name: '使用此模板', exact: true }).click()
  await page.waitForURL('**/resume/editor')
  await page.locator('[data-pagination-status=ready]').waitFor()
  assert.ok(await page.locator('[data-resume-source]').textContent().then(text => text.includes('个人简历')))
  await page.reload()
  await page.locator('[data-pagination-status=ready]').waitFor()
  assert.ok(await page.locator('[data-resume-source]').textContent().then(text => text.includes('林知夏')))
  await page.evaluate(() => {
    window.printedResume = null
    const observer = new MutationObserver(() => {
      for (const frame of document.querySelectorAll('iframe')) {
        try {
          frame.contentWindow.print = () => {
            window.printedResume = frame.contentDocument.documentElement.outerHTML
          }
        }
        catch {}
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  })
  await page.getByRole('button', { name: '导出简历', exact: true }).click()
  await page.getByRole('button', { name: '导出 PDF', exact: true }).click()
  await page.waitForFunction(() => window.printedResume)
  const printed = await page.evaluate(() => window.printedResume)
  assert.ok(printed.includes('Personal resume'))
  await writeFile('tests/resume-template/artifacts/app-print.html', printed)
  console.log('PASS 线上目录静态卡片→详细预览→本地创建→刷新持久化→编辑器真实PDF导出')
  await writeFile('tests/resume-template/artifacts/app-smoke-state.json', JSON.stringify({ url: page.url(), text: await page.locator('body').textContent() }))
}
finally { await browser.close() }
