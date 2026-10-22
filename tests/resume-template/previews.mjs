/* eslint-disable antfu/no-top-level-await, no-console */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import process from 'node:process'

const require = createRequire(import.meta.url)
const { chromium } = require(require.resolve('playwright', { paths: [process.env.PLAYWRIGHT_NODE_MODULES || process.cwd()] }))
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1200, height: 1400 }, deviceScaleFactor: 1 })
const base = process.env.RESUME_TEST_URL || 'http://127.0.0.1:5174'
const catalog = JSON.parse(await readFile('template-resources/catalog.json', 'utf8'))
const results = []
await mkdir('tests/resume-template/artifacts', { recursive: true })
try {
  for (const entry of catalog) {
    for (const preview of entry.previews) {
      const name = `${entry.templateId}-${preview.example.exampleId}`
      await page.goto(`${base}/tests/resume-template/harness.html?template=${entry.templateId}&example=${preview.example.exampleId}`)
      await page.waitForFunction(() => ['ready', 'error'].includes(window.resumeState?.status), { timeout: 30000 })
      const state = await page.evaluate(() => window.resumeState)
      assert.equal(state.status, 'ready', state.error)
      const bytes = await page.locator('[data-resume-page]').first().screenshot({ path: `tests/resume-template/artifacts/preview-${name}.png` })
      const hash = createHash('sha256').update(bytes).digest('hex')
      results.push({ name, expected: preview.asset.hash, actual: hash, matches: hash === preview.asset.hash })
    }
  }
  await writeFile('tests/resume-template/artifacts/previews-report.json', JSON.stringify(results, null, 2))
  assert.ok(results.every(result => result.matches), '静态预览与当前引擎输出不一致，查看 previews-report.json')
  console.log('PASS 4 published previews exactly match the final renderer')
}
finally { await browser.close() }
