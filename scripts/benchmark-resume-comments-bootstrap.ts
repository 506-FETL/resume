import process from 'node:process'

interface BenchmarkConfig {
  url: string
  publishableKey: string
  jwt: string | null
  accessBody: Record<string, unknown>
  samples: number
}

interface Sample {
  elapsedMs: number
  responseBytes: number
  status: number
  serverTiming: string | null
  edgeRegion: string | null
  authMode: string | null
  repair: string | null
}

const regions = ['auto', 'us-east-1'] as const

function readRequiredEnvironment(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function readConfig(): BenchmarkConfig {
  const samplesValue = process.env.RESUME_COMMENTS_BENCHMARK_SAMPLES ?? '20'
  const samples = Number.parseInt(samplesValue, 10)
  if (!Number.isSafeInteger(samples) || samples < 1) {
    throw new Error('RESUME_COMMENTS_BENCHMARK_SAMPLES must be a positive integer')
  }

  const accessBodyValue = process.env.RESUME_COMMENTS_ACCESS_BODY ?? '{}'
  let accessBody: unknown
  try {
    accessBody = JSON.parse(accessBodyValue)
  }
  catch {
    throw new Error('RESUME_COMMENTS_ACCESS_BODY must be a JSON object')
  }
  if (!accessBody || typeof accessBody !== 'object' || Array.isArray(accessBody)) {
    throw new Error('RESUME_COMMENTS_ACCESS_BODY must be a JSON object')
  }

  return {
    url: readRequiredEnvironment('RESUME_COMMENTS_FUNCTION_URL'),
    publishableKey: readRequiredEnvironment('SUPABASE_PUBLISHABLE_KEY'),
    jwt: process.env.SUPABASE_JWT?.trim() || null,
    accessBody: accessBody as Record<string, unknown>,
    samples,
  }
}

function percentile(samples: number[], ratio: number): number {
  const sorted = [...samples].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] ?? 0
}

function summarize(samples: Sample[]) {
  const durations = samples.map(sample => sample.elapsedMs)
  return {
    count: samples.length,
    P50: Number(percentile(durations, 0.5).toFixed(1)),
    P95: Number(percentile(durations, 0.95).toFixed(1)),
    max: Number(Math.max(...durations).toFixed(1)),
    statuses: [...new Set(samples.map(sample => sample.status))],
    responseBytes: [...new Set(samples.map(sample => sample.responseBytes))],
    serverTiming: [...new Set(samples.map(sample => sample.serverTiming).filter(Boolean))],
    edgeRegion: [...new Set(samples.map(sample => sample.edgeRegion).filter(Boolean))],
    authMode: [...new Set(samples.map(sample => sample.authMode).filter(Boolean))],
    repair: [...new Set(samples.map(sample => sample.repair).filter(Boolean))],
  }
}

function requestUrl(config: BenchmarkConfig, region: typeof regions[number]) {
  const url = new URL(config.url)
  if (region !== 'auto')
    url.searchParams.set('forceFunctionRegion', region)
  else
    url.searchParams.delete('forceFunctionRegion')
  return url
}

function requestHeaders(config: BenchmarkConfig): Record<string, string> {
  return {
    'apikey': config.publishableKey,
    ...(config.jwt ? { Authorization: `Bearer ${config.jwt}` } : {}),
    'Content-Type': 'application/json',
  }
}

async function runOptions(config: BenchmarkConfig, region: typeof regions[number]) {
  const startedAt = performance.now()
  const response = await fetch(requestUrl(config, region), {
    method: 'OPTIONS',
    headers: requestHeaders(config),
  })
  return {
    elapsedMs: Number((performance.now() - startedAt).toFixed(1)),
    status: response.status,
  }
}

async function runPost(config: BenchmarkConfig, region: typeof regions[number]): Promise<Sample> {
  const startedAt = performance.now()
  const response = await fetch(requestUrl(config, region), {
    method: 'POST',
    headers: requestHeaders(config),
    body: JSON.stringify(config.accessBody),
  })
  const responseText = await response.text()
  return {
    elapsedMs: performance.now() - startedAt,
    responseBytes: new TextEncoder().encode(responseText).byteLength,
    status: response.status,
    serverTiming: response.headers.get('server-timing'),
    edgeRegion: response.headers.get('x-sb-edge-region'),
    authMode: response.headers.get('x-comment-auth-mode'),
    repair: response.headers.get('x-comment-scope-repair'),
  }
}

async function main() {
  const config = readConfig()
  for (const region of regions) {
    const options = await runOptions(config, region)
    const samples: Sample[] = []
    for (let index = 0; index < config.samples; index += 1) {
      samples.push(await runPost(config, region))
    }
    if (
      region !== 'auto'
      && samples.some(sample => sample.edgeRegion !== region)
    ) {
      throw new Error('forced function region was not honored')
    }
    process.stdout.write(`${JSON.stringify({ region, options, ...summarize(samples) })}\n`)
  }
}

main().catch(() => {
  console.error('benchmark_failed')
  process.exitCode = 1
})
