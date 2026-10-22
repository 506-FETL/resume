/* eslint-disable antfu/no-top-level-await, no-console */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import process from 'node:process'

const require = createRequire(import.meta.url)
const { chromium } = require(require.resolve('playwright', { paths: [process.env.PLAYWRIGHT_NODE_MODULES || process.cwd()] }))
async function fingerprint() {
  const files = (await readdir('dist/assets')).filter(file => file.endsWith('.js')).sort()
  const hash = createHash('sha256')
  for (const file of files) hash.update(await readFile(`dist/assets/${file}`))
  return hash.digest('hex')
}
const before = await fingerprint()
const definition = JSON.parse(await readFile('template-resources/default/v2.json', 'utf8'))
definition.templateId = 'resource-only-verification'
definition.document.unshift({ id: 'release-proof', type: 'text', text: '纯资源发布验收', style: 'section-title' })
// 使用已定义的样式名，结构新增节点不需要重新构建应用。
definition.document[0].style = Object.keys(definition.styles)[0]
definition.tokens.primary = '#b73752'
const content = JSON.stringify(definition)
const catalog = JSON.parse(await readFile('template-resources/catalog.json', 'utf8'))
const item = structuredClone(catalog[0])
Object.assign(item, { templateId: definition.templateId, name: '纯资源发布验收模板', previews: [] })
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } })
const base = process.env.RESUME_TEST_URL || 'http://127.0.0.1:4173'
try {
  await page.route('**/rest/v1/official_resume_template_catalog?**', async (route) => {
    const response = await route.fetch()
    const rows = await response.json()
    if (!new URL(route.request().url()).searchParams.get('offset') || new URL(route.request().url()).searchParams.get('offset') === '0')
      rows.push({ metadata: item })
    await route.fulfill({ response, json: rows })
  })
  await page.route('**/rest/v1/official_resume_template_versions?**', async (route) => {
    if (new URL(route.request().url()).searchParams.get('template_id') === `eq.${definition.templateId}`)
      await route.fulfill({ json: [{ content, content_hash: createHash('sha256').update(content).digest('hex') }] })
    else await route.continue()
  })
  await page.goto(`${base}/template`)
  await page.getByRole('button', { name: '预览纯资源发布验收模板', exact: true }).click()
  await page.locator('[data-pagination-status=ready]').waitFor()
  await page.getByRole('dialog').getByText('纯资源发布验收', { exact: true }).waitFor()
  await page.getByRole('button', { name: '使用此模板', exact: true }).click()
  await page.waitForURL('**/resume/editor')
  await page.locator('[data-pagination-status=ready]').waitFor()
  assert.ok((await page.locator('[data-resume-source]').textContent()).includes('纯资源发布验收'))
  assert.equal(await fingerprint(), before)
  await writeFile('tests/resume-template/artifacts/frozen-build.json', JSON.stringify({ passed: true, bundleSha256: before, publishedOnlyInTestTransport: definition.templateId, createdAndRendered: true }, null, 2))
  console.log('PASS 冻结生产构建后，仅替换远程目录/定义响应即可预览、创建和渲染第三模板，JS构建哈希不变')
}
finally { await browser.close() }
