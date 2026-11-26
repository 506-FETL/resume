import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const pdfRequire = createRequire(require.resolve('pdfjs-dist/package.json'))
const { createCanvas, loadImage } = pdfRequire('@napi-rs/canvas')
const hashOf = (bytes) => createHash('sha256').update(bytes).digest('hex')
const bucket = 'resume-template-previews'

async function verifiedImage(base, asset, bust = false) {
  if (!/^[a-f0-9]{64}$/.test(asset.hash)) throw Error('素材哈希无效')

  const path = `/storage/v1/object/public/${bucket}/${asset.hash}`
  const url = new URL(path, base)

  if (bust) url.searchParams.set('verify', Date.now())

  const response = await fetch(url, { signal: AbortSignal.timeout(30000) })

  if (!response.ok) throw Error(`读取素材失败（HTTP ${response.status}）`)
  if (response.headers.get('content-type')?.split(';')[0] !== asset.mimeType)
    throw Error('预览素材 MIME 不一致')

  const bytes = Buffer.from(await response.arrayBuffer())

  if (bytes.length !== asset.byteLength || hashOf(bytes) !== asset.hash)
    throw Error('预览素材字节数或哈希不一致')

  const image = await loadImage(bytes)

  if (image.width !== asset.width || image.height !== asset.height)
    throw Error('预览素材解码尺寸不一致')

  return { image, cacheControl: response.headers.get('cache-control') }
}

export async function createCardImage(base, source) {
  const { image } = await verifiedImage(base, source)
  const width = Math.min(512, image.width)
  const height = Math.max(1, Math.round((image.height * width) / image.width))
  const canvas = createCanvas(width, height)
  const context = canvas.getContext('2d')

  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, width, height)

  const bytes = await canvas.encode('webp', 85)

  const card = {
    hash: hashOf(bytes),
    mimeType: 'image/webp',
    byteLength: bytes.length,
    width,
    height,
  }

  const decoded = await loadImage(bytes)

  if (
    bytes.length > 524288 ||
    decoded.width !== width ||
    decoded.height !== height ||
    bytes.toString('ascii', 0, 4) !== 'RIFF' ||
    bytes.toString('ascii', 8, 12) !== 'WEBP'
  )
    throw Error('小图编码或尺寸不符合发布要求')

  return { card, bytes }
}

async function readCards(base, apikey) {
  const entries = new Map()

  for (let offset = 0; ; offset += 100) {
    const url = new URL('/rest/v1/official_template_card_summaries', base)

    url.search = new URLSearchParams({
      select: 'default_asset,card_asset',
      order: 'sort_order.asc,template_id.asc',
      offset: String(offset),
      limit: '100',
    })

    const response = await fetch(url, {
      headers: { apikey },
      signal: AbortSignal.timeout(20000),
    })

    if (!response.ok) throw Error(`读取目录失败（HTTP ${response.status}）`)

    const rows = await response.json()

    for (const row of rows) entries.set(row.default_asset.hash, row)

    if (rows.length < 100) return [...entries.values()]
  }
}

async function adminKey(base) {
  const ref = (
    await readFile(
      new URL('../supabase/.temp/project-ref', import.meta.url),
      'utf8',
    )
  ).trim()

  if (new URL(base).origin !== `https://${ref}.supabase.co`)
    throw Error('环境与已链接项目不一致')

  const command = spawnSync(
    'pnpm',
    [
      'exec',
      'supabase',
      'projects',
      'api-keys',
      '--project-ref',
      ref,
      '--reveal',
      '-o',
      'json',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  )

  if (command.status !== 0) throw Error('无法取得已链接项目的维护凭据')

  const keys = JSON.parse(command.stdout)

  const service =
    keys.find((key) => key.name === 'service_role') ??
    keys.find((key) => key.type === 'secret')

  if (!service?.api_key) throw Error('当前项目缺少 Storage 维护凭据')

  return service.api_key
}

async function publishImage(base, key, card, bytes) {
  const url = new URL(`/storage/v1/object/${bucket}/${card.hash}`, base)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: key,
      ...(key.startsWith('eyJ') && { Authorization: `Bearer ${key}` }),
      'Content-Type': card.mimeType,
      'Cache-Control': 'max-age=31536000',
      'x-upsert': 'false',
    },
    body: bytes,
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    const problem = await response.json().catch(() => ({}))

    if (
      response.status !== 409 &&
      problem.statusCode !== '409' &&
      problem.error !== 'Duplicate'
    )
      throw Error(`上传小图失败（HTTP ${response.status}）`)
  }

  const checked = await verifiedImage(base, card, true)

  if (!checked.cacheControl?.includes('max-age=31536000'))
    throw Error('小图的 CDN 缓存时间未生效')
}

async function writeMappings(base, key, mappings) {
  if (!mappings.length) return

  const url = new URL(
    '/rest/v1/official_template_card_previews?on_conflict=source_hash',
    base,
  )

  const result = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: key,
      ...(key.startsWith('eyJ') && { Authorization: `Bearer ${key}` }),
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify(mappings),
    signal: AbortSignal.timeout(30000),
  })

  if (!result.ok) throw Error(`发布小图映射失败（HTTP ${result.status}）`)
}

async function run() {
  const base = process.env.VITE_SUPABASE_URL
  const apikey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  const publish = process.argv.includes('--publish')
  const entries = await readCards(base, apikey)
  const missing = entries.filter((entry) => !entry.card_asset)
  const key = publish && missing.length ? await adminKey(base) : null
  const mappings = []
  let originalBytes = 0
  let cardBytes = 0

  for (let offset = 0; offset < entries.length; offset += 4) {
    const batch = await Promise.allSettled(
      entries
        .slice(offset, offset + 4)
        .map(async ({ default_asset: source, card_asset: existing }) => {
          originalBytes += source.byteLength

          if (existing) {
            await verifiedImage(base, existing)
            cardBytes += existing.byteLength

            return
          }

          const { card, bytes } = await createCardImage(base, source)

          cardBytes += card.byteLength

          if (!key) return

          await publishImage(base, key, card, bytes)

          mappings.push({
            source_hash: source.hash,
            card_hash: card.hash,
            byte_size: card.byteLength,
            width: card.width,
            height: card.height,
          })
        }),
    )

    const failure = batch.find((item) => item.status === 'rejected')

    if (failure) throw failure.reason
  }

  if (key) {
    await writeMappings(base, key, mappings)

    const published = new Map(
      (await readCards(base, apikey)).map((entry) => [
        entry.default_asset.hash,
        entry.card_asset,
      ]),
    )

    for (const row of mappings) {
      if (published.get(row.source_hash)?.hash !== row.card_hash)
        throw Error('小图映射回读不一致')
    }
  }

  process.stdout.write(
    JSON.stringify({
      sources: entries.length,
      previouslyMapped: entries.length - missing.length,
      missing: missing.length,
      published: mappings.length,
      originalBytes,
      cardBytes,
    }) + '\n',
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  run().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
