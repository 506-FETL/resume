import type { TemplateDefinition } from '../src/lib/resume-template/definition-schema'
import type { ResumeExample, TemplateAssetRef, TemplateCatalogItem } from '../src/lib/resume-template/source/types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

// 只生成待审查 SQL，不连接数据库。正式发布必须包含每套模板/示例的精确预览。
const argumentsList = process.argv.slice(2)
const allowMissingPreviews = argumentsList.includes('--allow-missing-previews')
const outputArguments = argumentsList.filter(argument => argument !== '--allow-missing-previews')
if (outputArguments.length !== 1 || outputArguments[0].startsWith('--'))
  throw new Error('用法：node scripts/build-template-seed.ts <输出 SQL 文件> [--allow-missing-previews（仅隔离验证）]')
const output = outputArguments[0]
const root = fileURLToPath(new URL('../template-resources/', import.meta.url))
const quote = (value: string) => `'${value.replaceAll('\'', '\'\'')}'`
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8'))
const server = await createServer({ server: { middlewareMode: true, watch: null, ws: false }, appType: 'custom' })

/** 检查实际图片头，不能以声明的 MIME、尺寸替代二进制校验。 */
function imageMetadata(data: Buffer): Pick<TemplateAssetRef, 'mimeType' | 'width' | 'height'> {
  if (data.length >= 24 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && data.toString('ascii', 12, 16) === 'IHDR')
    return { mimeType: 'image/png', width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
  if (data.length >= 30 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') {
    const format = data.toString('ascii', 12, 16)
    if (format === 'VP8X')
      return { mimeType: 'image/webp', width: data.readUIntLE(24, 3) + 1, height: data.readUIntLE(27, 3) + 1 }
    if (format === 'VP8 ' && data.subarray(23, 26).equals(Buffer.from([157, 1, 42])))
      return { mimeType: 'image/webp', width: data.readUInt16LE(26) & 0x3FFF, height: data.readUInt16LE(28) & 0x3FFF }
    if (format === 'VP8L' && data[20] === 47) {
      const bits = data.readUInt32LE(21)
      return { mimeType: 'image/webp', width: (bits & 0x3FFF) + 1, height: ((bits >>> 14) & 0x3FFF) + 1 }
    }
  }
  if (data.length >= 4 && data[0] === 255 && data[1] === 216) {
    let offset = 2
    while (offset + 4 <= data.length) {
      if (data[offset++] !== 255)
        break
      while (data[offset] === 255) offset++
      const marker = data[offset++]
      if (marker === 217 || marker === 218)
        break
      if (marker === 1 || (marker >= 208 && marker <= 215))
        continue
      const length = data.readUInt16BE(offset)
      if (length < 2 || offset + length > data.length)
        break
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && length >= 8)
        return { mimeType: 'image/jpeg', width: data.readUInt16BE(offset + 5), height: data.readUInt16BE(offset + 3) }
      offset += length
    }
  }
  throw new Error('模板素材不是受支持的 PNG、WebP 或 JPEG 图片')
}

async function collectAssets(directory: string, files: Map<string, Buffer>): Promise<void> {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  }
  catch (error) {
    if ((error as { code?: string }).code === 'ENOENT')
      return
    throw error
  }
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      await collectAssets(path, files)
    }
    else if (entry.isFile() && /\.(?:png|webp|jpe?g)$/i.test(entry.name)) {
      const data = await readFile(path)
      if (data.byteLength > 524288)
        throw new Error(`素材超过 512 KiB：${entry.name}`)
      imageMetadata(data)
      files.set(hash(data), data)
    }
  }
}

try {
  const { parseTemplateDefinition }: { parseTemplateDefinition: (input: unknown) => TemplateDefinition } = await server.ssrLoadModule('/src/lib/resume-template/definition-schema.ts')
  const { catalogItemSchema, exampleSchema } = await server.ssrLoadModule('/src/lib/resume-template/source/resource-schema.ts')
  const catalog = catalogItemSchema.array().min(1).max(500).parse(await readJson(join(root, 'catalog.json'))) as TemplateCatalogItem[]
  if (new Set(catalog.map(item => item.templateId)).size !== catalog.length)
    throw new Error('目录出现重复模板身份')
  const definitions = new Map<string, TemplateDefinition>()
  const examples = new Map<string, ResumeExample>()
  const assets = new Map<string, TemplateAssetRef>()
  const registerAsset = (asset: TemplateAssetRef) => {
    const existing = assets.get(asset.hash)
    if (existing && (existing.mimeType !== asset.mimeType || existing.byteLength !== asset.byteLength || existing.width !== asset.width || existing.height !== asset.height))
      throw new Error(`同一素材哈希的清单属性不一致：${asset.hash}`)
    assets.set(asset.hash, asset)
  }
  for (const item of catalog) {
    const definition = parseTemplateDefinition(await readJson(join(root, item.templateId, `v${item.currentVersion}.json`)))
    if (definition.templateId !== item.templateId || definition.version !== item.currentVersion)
      throw new Error(`目录与模板身份不符：${item.templateId}`)
    definitions.set(item.templateId, definition)
    for (const ref of item.examples) {
      const key = `${ref.exampleId}@${ref.version}`
      if (!examples.has(key)) {
        const rawExample = await readJson(join(root, 'examples', ref.exampleId, `v${ref.version}.json`))
        exampleSchema.parse(rawExample)
        // 示例版本独立于协议升级，保留既有确定文本和哈希。
        const example = rawExample as ResumeExample
        if (example.exampleId !== ref.exampleId || example.version !== ref.version)
          throw new Error(`示例文件身份不符：${key}`)
        examples.set(key, example)
      }
      const preview = item.previews.find(preview => preview.example.exampleId === ref.exampleId && preview.example.version === ref.version)
      if (!preview && !allowMissingPreviews)
        throw new Error(`正式发布缺少精确预览：${item.templateId}@${item.currentVersion}/${key}`)
      if (preview && (preview.projectionReferenceDate !== examples.get(key)!.projectionReferenceDate || JSON.stringify(preview.appearance) !== JSON.stringify(definition.appearanceDefaults)))
        throw new Error(`预览外观或参考日期与资源不符：${item.templateId}/${key}`)
      if (preview)
        registerAsset(preview.asset)
    }
    for (const asset of definition.assets)
      registerAsset({ hash: asset.sha256, byteLength: asset.bytes, mimeType: asset.mimeType, width: asset.width, height: asset.height })
  }

  const assetFiles = new Map<string, Buffer>()
  await collectAssets(join(root, 'previews'), assetFiles)
  await collectAssets(join(root, 'assets'), assetFiles)
  const statements = [
    '-- 声明式模板发布：仅插入缺失的不可变版本，校验同版本内容，最后切换目录。',
    ...(allowMissingPreviews ? ['-- 仅供隔离验收：允许缺失预览，不得用于正式目录发布。'] : []),
    'begin;',
    'set local standard_conforming_strings = on;',
  ]
  const check = (condition: string, label: string) => statements.push(`do $resource_check$ begin if not (${condition}) then raise exception ${quote(label)} using errcode = '23514'; end if; end $resource_check$;`)
  for (const [assetHash, asset] of [...assets].sort(([a], [b]) => a.localeCompare(b))) {
    const data = assetFiles.get(assetHash)
    if (!data)
      throw new Error(`缺少素材文件：${assetHash}`)
    const actual = imageMetadata(data)
    if (data.byteLength !== asset.byteLength || actual.mimeType !== asset.mimeType || actual.width !== asset.width || actual.height !== asset.height)
      throw new Error(`素材实际尺寸、类型或体积与清单不符：${assetHash}`)
    const encoded = data.toString('base64')
    statements.push(`insert into public.official_resume_assets (content_hash, mime_type, byte_size, width, height, content_base64, published_at) values (${quote(assetHash)}, ${quote(asset.mimeType)}, ${asset.byteLength}, ${asset.width}, ${asset.height}, ${quote(encoded)}, now()) on conflict (content_hash) do nothing;`)
    check(`exists (select 1 from public.official_resume_assets where content_hash = ${quote(assetHash)} and mime_type = ${quote(asset.mimeType)} and byte_size = ${asset.byteLength} and width = ${asset.width} and height = ${asset.height} and content_base64 = ${quote(encoded)} and published_at is not null)`, '既有不可变素材与发布清单不一致')
  }
  const insert = (table: string, idColumn: string, id: string, version: number, payload: unknown) => {
    const content = JSON.stringify(payload)
    const contentHash = hash(content)
    statements.push(`insert into public.${table} (${idColumn}, version, content, content_hash, published_at) values (${quote(id)}, ${version}, ${quote(content)}, ${quote(contentHash)}, now()) on conflict (${idColumn}, version) do nothing;`)
    check(`exists (select 1 from public.${table} where ${idColumn} = ${quote(id)} and version = ${version} and content_hash = ${quote(contentHash)} and published_at is not null)`, `既有不可变资源与发布内容不一致：${id}@${version}`)
  }
  for (const [key, example] of [...examples].sort(([a], [b]) => a.localeCompare(b))) {
    if (key !== `${example.exampleId}@${example.version}`)
      throw new Error('示例身份发生变化')
    insert('official_resume_example_versions', 'example_id', example.exampleId, example.version, example)
  }
  for (const [index, item] of catalog.entries()) {
    insert('official_resume_template_versions', 'template_id', item.templateId, item.currentVersion, definitions.get(item.templateId))
    statements.push(`insert into public.official_resume_template_catalog (template_id, current_version, sort_order, listed, metadata) values (${quote(item.templateId)}, ${item.currentVersion}, ${index}, true, ${quote(JSON.stringify(item))}::jsonb) on conflict (template_id) do update set current_version = excluded.current_version, sort_order = excluded.sort_order, listed = excluded.listed, metadata = excluded.metadata;`)
  }
  statements.push('commit;')
  await writeFile(output, `${statements.join('\n')}\n`)
  process.stdout.write(`已生成 ${catalog.length} 套模板、${examples.size} 个独立示例、${assets.size} 个素材的发布 SQL：${output}\n`)
}
finally {
  await server.close()
}
