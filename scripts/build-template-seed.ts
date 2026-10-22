import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import { createServer } from 'vite'

// 输出 SQL 到明确指定文件；不连接数据库、不自动发布。
const output = process.argv[2]
if (!output)
  throw new Error('请指定输出 SQL 文件')
const server = await createServer({ server: { middlewareMode: true, watch: null, ws: false }, appType: 'custom' })
const quote = (value: string) => `'${value.replaceAll('\'', '\'\'')}'`
try {
  const { localTemplateSource } = await server.ssrLoadModule('/src/lib/resume-template/source/local.ts')
  const catalog = await localTemplateSource.listTemplates()
  const examples = new Map(catalog.flatMap((item: { examples: Array<{ exampleId: string, version: number }> }) => item.examples.map(ref => [`${ref.exampleId}@${ref.version}`, ref])))
  const statements: string[] = ['-- 精确迁移既有配置；发布内容和哈希不可原地覆盖。']
  const insert = (table: string, idColumn: string, id: string, version: number, payload: unknown) => {
    const content = JSON.stringify(payload)
    const hash = createHash('sha256').update(content).digest('hex')
    statements.push(`insert into public.${table} (${idColumn}, version, content, content_hash, published_at) values (${quote(id)}, ${version}, ${quote(content)}, ${quote(hash)}, now());`)
  }
  for (const ref of examples.values()) {
    const example = await localTemplateSource.getExample(ref)
    insert('official_resume_example_versions', 'example_id', example.exampleId, example.version, example)
  }
  for (const [index, item] of catalog.entries()) {
    const definition = await localTemplateSource.getTemplateVersion({ templateId: item.templateId, templateVersion: item.currentVersion })
    insert('official_resume_template_versions', 'template_id', item.templateId, item.currentVersion, definition)
    statements.push(`insert into public.official_resume_template_catalog (template_id, current_version, sort_order, listed, metadata) values (${quote(item.templateId)}, ${item.currentVersion}, ${index}, true, ${quote(JSON.stringify(item))}::jsonb);`)
  }
  await writeFile(output, `${statements.join('\n')}\n`)
}
finally {
  await server.close()
}
