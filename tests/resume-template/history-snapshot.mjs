/* eslint-disable antfu/no-top-level-await, no-console */
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import process from 'node:process'

const require = createRequire(import.meta.url)
const { chromium } = require(require.resolve('playwright', { paths: [process.env.PLAYWRIGHT_NODE_MODULES || process.cwd()] }))
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const page = await browser.newPage()
try {
  await page.goto(`${process.env.RESUME_TEST_URL || 'http://127.0.0.1:5174'}/tests/resume-template/harness.html?template=default`)
  await page.waitForFunction(() => window.resumeState?.status === 'ready')
  const result = await page.evaluate(async () => {
    const { buildResumeSnapshot } = await import('/src/pages/history/utils.ts')
    const current = structuredClone(window.resumeFixture)
    const input = structuredClone(current)
    const historical = buildResumeSnapshot(input)
    const before = JSON.stringify(historical)
    current.basics.name = '当前编辑已修改'
    current.templateBinding = { source: 'official', templateId: 'classic-ribbon', templateVersion: 2 }
    current.font.fontSize = 22
    input.basics.name = '快照输入已修改'
    input.font.fontSize = 24
    input.order.reverse()
    delete input.templateBinding
    let missingBindingRejected = false
    try {
      buildResumeSnapshot(input)
    }
    catch (error) {
      missingBindingRejected = error.message.includes('缺少有效模板引用')
    }
    return { isolated: JSON.stringify(historical) === before, binding: historical.templateBinding, fontSize: historical.font.fontSize, missingBindingRejected }
  })
  assert.ok(result.isolated)
  assert.ok(result.missingBindingRejected)
  assert.deepEqual(result.binding, { source: 'official', templateId: 'default', templateVersion: 2 })
  assert.equal(result.fontSize, 14)
  await writeFile('tests/resume-template/artifacts/history-snapshot-report.json', JSON.stringify(result, null, 2))
  console.log('PASS 历史快照保留精确模板和外观，独立于当前编辑及外部输入，缺绑定拒绝')
}
finally { await browser.close() }
