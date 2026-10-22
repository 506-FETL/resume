import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

async function main() {
  const server = await createServer({ server: { middlewareMode: true, watch: null, ws: false }, appType: 'custom' })
  try {
    const { parseTemplateDefinition } = await server.ssrLoadModule('/src/lib/resume-template/definition-schema.ts')
    const { DeclarativeRenderer } = await server.ssrLoadModule('/src/components/resume/runtime/declarative-renderer.tsx')
    const { ResumeContextProvider } = await server.ssrLoadModule('/src/components/resume/runtime/context/resume-context.tsx')
    const { createTemplateStyleEnvironment, resolveTemplateStyle } = await server.ssrLoadModule('/src/lib/resume-template/declarative/styles.ts')
    const { resolveResumeAppearanceStyles } = await server.ssrLoadModule('/src/lib/resume-template/runtime/resolve-appearance.ts')
    const { resolveList } = await server.ssrLoadModule('/src/lib/resume-template/declarative/bindings.ts')
    const definition = parseTemplateDefinition(JSON.parse(await readFile(new URL('../../template-resources/default/v2.json', import.meta.url), 'utf8')))
    const field = (key: string, text: string) => ({ sectionKey: 'basics', entryId: 'singleton', fieldKey: key, nodeKey: `basics/singleton/${key}`, label: key, text })
    const name = field('name', '虚构测试者')
    const phone = field('phone', '10000000000')
    const empty = field('email', '')
    const profile = { name, fields: [name, empty, phone], meta: [], contact: [phone], jobIntent: [] }
    const content = { profile, sections: [] }
    const styles = resolveResumeAppearanceStyles(definition.appearanceDefaults)
    const context = { ...styles, commentNodesByKey: new Map([name, phone].map(item => [item.nodeKey, { text: item.text }])), projectionReferenceDate: '2026-10-22' }
    function render(template: any, contentInput = content) {
      return renderToStaticMarkup(createElement(ResumeContextProvider, { value: context }, createElement(DeclarativeRenderer, { definition: template, content: contentInput, environment: createTemplateStyleEnvironment(template, template.appearanceDefaults) })))
    }
    const markup = render(definition)
    assert.match(markup, /虚构测试者/)
    assert.match(markup, /data-section="basics"/)
    assert.match(markup, /id="resume-section-basics"/)
    assert.match(markup, /data-comment-node-key="basics\/singleton\/name"/)
    assert.doesNotMatch(markup, /求职意向：/)
    assert.doesNotMatch(markup, /data-layout-node="sections"/)
    const ordered = resolveList('profile.fields', { profile }, ['phone', 'name'])
    assert.deepEqual(ordered.map((item: any) => item.fieldKey), ['phone', 'name'])
    const environment = createTemplateStyleEnvironment(definition, { ...definition.appearanceDefaults, font: { fontFamily: 'noto-sans-sc', fontSize: 20 }, theme: { theme: 'blue' } })
    assert.equal(environment.numbers.nameSize, 30)
    assert.equal(resolveTemplateStyle({ fontSize: { token: 'contentSize' }, marginLeft: -33 }, environment).fontSize, '17.5px')
    assert.equal(resolveTemplateStyle({ marginLeft: -33 }, environment).marginLeft, '-33px')
    assert.equal(environment.colors.primary, '#1e40af')
    // 第三份完全不同的文档/标题/经历结构，仅通过数据定义，不登记模板 ID。
    const third = parseTemplateDefinition({
      ...definition,
      templateId: 'fictional-ledger',
      document: [{ id: 'alternate-document', type: 'box', layout: 'row', children: [{ id: 'alternate-brand', type: 'text', text: 'THIRD RESOURCE' }, { id: 'alternate-name', type: 'field', binding: 'profile.name' }, { id: 'alternate-sections', type: 'sections' }] }],
      section: [{ id: 'alternate-section-name', type: 'text', binding: 'section.title' }, { id: 'alternate-blocks', type: 'blocks' }],
    })
    const thirdMarkup = render(third)
    assert.match(thirdMarkup, /THIRD RESOURCE/)
    assert.match(thirdMarkup, /虚构测试者/)
    assert.doesNotMatch(thirdMarkup, /data-layout-node="document"/)
    const filtered = { ...third, document: [{ id: 'filtered-repeat', type: 'repeat', layout: 'row', source: 'profile.fields', separator: '|', children: [{ id: 'filtered-value', type: 'field', binding: 'item', when: { binding: 'item.label', operator: 'equals', value: 'phone' } }] }] }
    assert.doesNotMatch(render(filtered), /\|/)
    const duplicate = { ...third, document: [...third.document, { id: 'second-name', type: 'field', binding: 'profile.name' }] }
    assert.throws(() => render(duplicate), /多个主评论投影/)
    duplicate.document[1].projection = 'display'
    assert.equal((render(duplicate).match(/data-comment-node-key=/g) ?? []).length, 1)
    const excessive = { ...third, document: [{ id: 'many', type: 'repeat', layout: 'stack', source: 'profile.fields', children: [{ id: 'constant', type: 'text', text: 'x' }] }] }
    assert.throws(() => render(excessive, { profile: { ...profile, fields: Array.from({ length: 30001 }, (_, index) => field(`test${index}`, 'x')) }, sections: [] }), /渲染预算/)
    const shapeHeavy = { ...excessive, document: [{ ...excessive.document[0], children: [{ id: 'shapes', type: 'shape', viewBox: [0, 0, 10, 10], shapes: Array.from({ length: 32 }, () => ({ kind: 'circle', cx: 5, cy: 5, radius: 4 })) }] }] }
    assert.throws(() => render(shapeHeavy, { profile: { ...profile, fields: Array.from({ length: 900 }, (_, index) => field(`shape${index}`, 'x')) }, sections: [] }), /渲染预算/)
    console.warn('渲染验证通过：字段身份、空值过滤、样式外观、第三模板、重复投影与展开预算')
  }
  finally {
    await server.close()
  }
}
main().then(() => process.exit(0)).catch((error) => {
  console.error(error)
  process.exit(1)
})
