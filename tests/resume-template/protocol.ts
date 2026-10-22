import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { createServer } from 'vite'

async function main() {
  const server = await createServer({ server: { middlewareMode: true, watch: null, ws: false }, appType: 'custom' })
  try {
    const { parseTemplateDefinition, TemplateResolutionError } = await server.ssrLoadModule('/src/lib/resume-template/definition-schema.ts')
    const definitions = await Promise.all(['default', 'classic-ribbon'].map(async id => JSON.parse(await readFile(new URL(`../../template-resources/${id}/v2.json`, import.meta.url), 'utf8'))))
    definitions.forEach(definition => assert.equal(parseTemplateDefinition(definition).version, 2))
    let cases = 0
    function reject(change: (definition: any) => void, expectedCode?: string) {
      const definition = structuredClone(definitions[0])
      change(definition)
      assert.throws(() => parseTemplateDefinition(definition), (error: unknown) => error instanceof TemplateResolutionError && (!expectedCode || error.code === expectedCode))
      cases++
    }
    reject(d => d.schemaVersion = 1, 'UNSUPPORTED_CAPABILITY')
    reject(d => d.renderContract = 'resume-v1', 'UNSUPPORTED_CAPABILITY')
    reject(d => d.document[0].type = 'script')
    reject(d => d.document[0].onClick = 'alert(1)')
    reject(d => d.document[0].style = 'missing')
    reject(d => d.document.push(structuredClone(d.document[0])))
    reject(d => d.document.push({ id: 'invalid-field', type: 'field', binding: 'item.companyName' }))
    reject(d => d.document.push({ id: 'wrong-scope', type: 'field', binding: 'item.title' }))
    reject(d => d.document.push({ id: 'bad-text', type: 'text', text: 'hello', binding: 'section.title' }))
    reject(d => d.document.push({ id: 'bad-asset', type: 'image', asset: 'unknown', alt: '' }))
    reject(d => d.document.push({ id: 'bad-shape', type: 'shape', viewBox: [0, 0, 10, 10], shapes: [{ kind: 'path', d: '<script>alert(1)</script>' }] }))
    reject(d => d.document.push({ id: 'incomplete-path', type: 'shape', viewBox: [0, 0, 10, 10], shapes: [{ kind: 'path', d: 'M0 0 L5' }] }))
    reject(d => d.document.push({ id: 'large-path', type: 'shape', viewBox: [0, 0, 10, 10], shapes: [{ kind: 'path', d: 'M99999 0 L5 5' }] }))
    reject(d => d.styles.document.color = 'url(https://invalid.example)')
    reject(d => d.styles.document.fontSize = '14px')
    reject(d => d.styles.document.height = 10)
    reject(d => d.document.push({ id: 'wrong-nested-scope', type: 'repeat', source: 'profile.fields', layout: 'stack', children: [{ id: 'wrong-section-title', type: 'text', binding: 'section.title' }] }))
    reject(d => d.styles.document.position = 'absolute')
    reject(d => d.capabilities.push('independent-columns'), 'UNSUPPORTED_CAPABILITY')
    reject((d) => {
      d.document = [{ id: 'bulk', type: 'text', text: 'x'.repeat(256 * 1024) }]
    }, 'RESOURCE_LIMIT')
    reject((d) => {
      let node: any = { id: 'deep-leaf', type: 'text', text: 'x' }
      for (let index = 0; index < 18; index++) node = { id: `deep-${index}`, type: 'box', layout: 'stack', children: [node] }
      d.document = [node]
    }, 'RESOURCE_LIMIT')
    reject(d => d.document = Array.from({ length: 510 }, (_, index) => ({ id: `wide-${index}`, type: 'text', text: 'x' })), 'RESOURCE_LIMIT')
    console.warn(`协议验证通过：2 份正式资源，${cases} 组拒绝样本`)
  }
  finally {
    await server.close()
  }
}
main().then(() => process.exit(0)).catch((error) => {
  console.error(error)
  process.exit(1)
})
