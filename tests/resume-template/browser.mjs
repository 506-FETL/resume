/* eslint-disable antfu/no-top-level-await, no-console */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import process from 'node:process'

const require = createRequire(import.meta.url)
const { chromium } = require(require.resolve('playwright', { paths: [process.env.PLAYWRIGHT_NODE_MODULES || process.cwd()] }))
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 1200, height: 1400 }, deviceScaleFactor: 1 })
const page = await context.newPage()
page.on('pageerror', error => console.error('PAGE ERROR', error.message))
const base = process.env.RESUME_TEST_URL || 'http://127.0.0.1:5174'
await mkdir('tests/resume-template/artifacts', { recursive: true })
await mkdir('template-resources/previews', { recursive: true })
const report = []
async function ready() {
  await page.waitForFunction(() => ['ready', 'error'].includes(window.resumeState?.status), { timeout: 30000 })
  const state = await page.evaluate(() => window.resumeState)
  assert.equal(state.status, 'ready', state.error)
  return state
}
try {
  for (const template of ['default', 'classic-ribbon']) {
    for (const example of ['graduate', 'frontend']) {
      await page.goto(`${base}/tests/resume-template/harness.html?template=${template}&example=${example}`)
      const state = await ready()
      if (!process.env.SKIP_PREVIEWS)
        await page.locator('[data-resume-page]').first().screenshot({ path: `template-resources/previews/${template}-${example}.png` })
      report.push({ template, example, state })
    }
  }
  for (const template of ['default', 'classic-ribbon']) {
    for (const mode of ['short', 'boundary', 'long']) {
      await page.goto(`${base}/tests/resume-template/harness.html?template=${template}&mode=${mode}`)
      let state = await ready()
      if (mode === 'boundary') {
        // 根据真实字体下的两次测量寻找最后一行接近页底的样本。
        const measure = async (count) => {
          await page.evaluate((count) => {
            const data = structuredClone(window.resumeFixture)
            data.self_evaluation.content = Array.from({ length: count }, (_, i) => `<p>临界行 ${i + 1} —— 完整文字不得被分页裁切。</p>`).join('')
            window.setResumeFixture(data)
          }, count)
          await page.waitForTimeout(150)
          return ready()
        }
        const one = await measure(1)
        const two = await measure(2)
        const step = two.signature.contentHeight - one.signature.contentHeight
        const count = Math.floor((one.signature.viewportHeight - one.signature.contentHeight) / step) + 1
        state = await measure(count)
        assert.ok(state.signature.viewportHeight - state.signature.contentHeight < step + 1)
        assert.equal(state.signature.pages.length, 1)
        report.push({ template, mode, criticalCount: count, bottomGap: state.signature.viewportHeight - state.signature.contentHeight })
        state = await measure(count + 1)
        assert.equal(state.signature.pages.length, 2)
      }
      if (mode === 'long')
        assert.ok(state.signature.pages.length >= 3)
      await page.evaluate(() => {
        window.printedResume = null
        const capture = () => {
          for (const frame of document.querySelectorAll('iframe')) {
            try {
              frame.contentWindow.print = () => {
                window.printedResume = frame.contentDocument.documentElement.outerHTML
              }
            }
            catch {}
          }
        }
        window.printObserver?.disconnect()
        window.printObserver = new MutationObserver(capture)
        window.printObserver.observe(document.body, { childList: true, subtree: true })
      })
      await page.locator('#print').click()
      await page.waitForFunction(() => window.printedResume, { timeout: 20000 })
      const html = await page.evaluate(() => window.printedResume)
      assert.ok(html.includes('data-resume-document'))
      const printPage = await context.newPage()
      await printPage.goto(`${base}/tests/resume-template/harness.html?template=${template}`)
      await printPage.setContent(html.replace('<head>', `<head><base href="${base}/">`))
      await printPage.evaluate(() => document.fonts.ready)
      for (const printBackground of [false, true]) {
        const name = `${template}-${mode}-background-${printBackground}`
        await printPage.pdf({ path: `tests/resume-template/artifacts/${name}.pdf`, printBackground, preferCSSPageSize: true })
      }
      await printPage.close()
      const word = await page.evaluate(() => window.exportWord())
      assert.ok(word.includes('自我评价'))
      assert.ok(!word.includes('<svg'))
      await writeFile(`tests/resume-template/artifacts/${template}-${mode}.doc`, word)
      report.push({ template, mode, pages: state.signature.pages.length, signature: state.signature, printCaptured: true })
      console.log(`PDF ${template}/${mode}: ${state.signature.pages.length} pages, background on/off`)
    }
    for (const font of ['noto-sans-sc', 'ibm-plex-sans-sc', 'noto-serif-sc', 'lxgw-wenkai', 'arimo', 'zcool-xiaowei']) {
      await page.goto(`${base}/tests/resume-template/harness.html?template=${template}&font=${font}`)
      const state = await ready()
      report.push({ template, font, pages: state.signature.pages.length })
    }
  }
  await writeFile('tests/resume-template/artifacts/browser-report.json', JSON.stringify(report, null, 2))
  console.log('PASS template previews, short/boundary/long print entry, Word, 12 font combinations')
}
finally { await browser.close() }
