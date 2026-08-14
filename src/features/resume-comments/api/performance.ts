import type {
  CommentAuthMode,
  CommentBootstrapClientStage,
  CommentResponseTelemetry,
} from './client.ts'

export type CommentPerformanceStage
  = | 'cache'
    | 'bootstrap'
    | 'source'
    | 'mutation'
    | 'realtime_recovery'
    | CommentBootstrapClientStage
    | 'transport_overhead'

export type CommentPerformanceAuthMode = CommentAuthMode | 'unknown' | 'not_applicable'
export type CommentPerformanceBoolean = boolean | 'unknown'
export type CommentPerformanceProtocolVersion = 1 | 'unknown'
export type CommentPerformanceEdgeRegion
  = | 'unknown'
    | 'us-east-1'
    | 'ap-northeast-2'
    | 'other'

export interface CommentPerformanceDimensions {
  authMode: CommentPerformanceAuthMode
  coldStart: CommentPerformanceBoolean
  repair: CommentPerformanceBoolean
  protocolVersion: CommentPerformanceProtocolVersion
  edgeRegion: CommentPerformanceEdgeRegion
}

export interface CommentPerformanceSnapshotEntry extends CommentPerformanceDimensions {
  stage: CommentPerformanceStage
  count: number
  windowSize: 50
  p50: number
  p95: number
  max: number
}

type CommentServerTimingName
  = | 'auth_anonymous'
    | 'auth_local'
    | 'auth_legacy'
    | 'access_token'
    | 'rpc'
    | 'repair'
    | 'realtime_token'
    | 'serialize'
    | 'edge_total'
    | 'total'

export type CommentServerDurations = Partial<Record<CommentServerTimingName, number>>

interface CommentPerformanceSample {
  stage: CommentPerformanceStage
  duration: number
  requestCount: number
  requestId?: string | null
  serverDurations: CommentServerDurations
  transportOverhead: number | null
  responseBytes: number | null
  dimensions: CommentPerformanceDimensions
  detail?: Record<string, string | number | boolean>
}

interface CommentPerformanceEndOptions {
  requestId?: string | null
  serverTiming?: string | null
  telemetry?: CommentResponseTelemetry | null
  detail?: Record<string, string | number | boolean>
}

const COMMENT_PERFORMANCE_WINDOW_SIZE = 50 as const
const COMMENT_SERVER_TIMING_NAMES = new Set<CommentServerTimingName>([
  'auth_anonymous',
  'auth_local',
  'auth_legacy',
  'access_token',
  'rpc',
  'repair',
  'realtime_token',
  'serialize',
  'edge_total',
  'total',
])
const COMMENT_PERFORMANCE_STAGES = new Set<CommentPerformanceStage>([
  'cache',
  'bootstrap',
  'source',
  'mutation',
  'realtime_recovery',
  'auth_token',
  'fetch_headers',
  'response_body',
  'normalize',
  'store_commit',
  'realtime_connect',
  'transport_overhead',
])
const COMMENT_BOOTSTRAP_CLIENT_STAGES = new Set<CommentBootstrapClientStage>([
  'auth_token',
  'fetch_headers',
  'response_body',
  'normalize',
  'store_commit',
  'realtime_connect',
])
const COMMENT_AUTH_MODES = new Set<CommentPerformanceAuthMode>([
  'anonymous',
  'local_jwks',
  'legacy_auth',
  'unknown',
  'not_applicable',
])
const COMMENT_EDGE_REGIONS = new Set<CommentPerformanceEdgeRegion>([
  'unknown',
  'us-east-1',
  'ap-northeast-2',
  'other',
])

interface CommentPerformanceBucket {
  dimensions: CommentPerformanceDimensions
  stage: CommentPerformanceStage
  durations: number[]
}

const buckets = new Map<string, CommentPerformanceBucket>()

function normalizeEdgeRegion(value: string | null | undefined): CommentPerformanceEdgeRegion {
  if (!value)
    return 'unknown'
  if (value === 'us-east-1' || value === 'ap-northeast-2')
    return value
  return 'other'
}

function normalizeDimensions(
  value: Partial<CommentPerformanceDimensions> = {},
): CommentPerformanceDimensions {
  const authMode = COMMENT_AUTH_MODES.has(value.authMode ?? 'not_applicable')
    ? value.authMode ?? 'not_applicable'
    : 'unknown'
  const edgeRegion = COMMENT_EDGE_REGIONS.has(value.edgeRegion ?? 'unknown')
    ? value.edgeRegion ?? 'unknown'
    : 'other'
  return {
    authMode,
    coldStart: typeof value.coldStart === 'boolean' ? value.coldStart : 'unknown',
    repair: typeof value.repair === 'boolean' ? value.repair : 'unknown',
    protocolVersion: value.protocolVersion === 1 ? 1 : 'unknown',
    edgeRegion,
  }
}

function dimensionsFromTelemetry(
  telemetry?: CommentResponseTelemetry | null,
): CommentPerformanceDimensions {
  if (!telemetry)
    return normalizeDimensions()
  return normalizeDimensions({
    authMode: telemetry.authMode,
    coldStart: telemetry.coldStart,
    repair: telemetry.repair,
    protocolVersion: telemetry.protocolVersion,
    edgeRegion: normalizeEdgeRegion(telemetry.edgeRegion),
  })
}

function bucketKey(stage: CommentPerformanceStage, dimensions: CommentPerformanceDimensions) {
  return JSON.stringify([stage, dimensions.authMode, dimensions.coldStart, dimensions.repair, dimensions.protocolVersion, dimensions.edgeRegion])
}

function percentile(sorted: number[], ratio: number) {
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)] ?? 0
}

export function parseCommentServerTiming(value?: string | null): CommentServerDurations {
  if (!value)
    return {}
  const durations: CommentServerDurations = {}
  for (const entry of value.split(',')) {
    const [rawName, ...parameters] = entry.trim().split(';')
    const name = rawName?.trim() as CommentServerTimingName
    if (!COMMENT_SERVER_TIMING_NAMES.has(name) || durations[name] !== undefined)
      continue
    const durationParameter = parameters.find(parameter => parameter.trim().startsWith('dur='))
    const durationText = durationParameter?.trim().slice(4).trim() ?? ''
    if (!durationText)
      continue
    const duration = Number(durationText)
    if (!Number.isFinite(duration) || duration < 0)
      continue
    durations[name] = duration
  }
  return durations
}

export function calculateCommentTransportOverhead(
  clientDurations: Partial<Record<CommentBootstrapClientStage, number>>,
  serverDurations: CommentServerDurations,
) {
  return Math.max(
    0,
    (clientDurations.fetch_headers ?? 0)
    - (serverDurations.edge_total ?? serverDurations.total ?? 0),
  )
}

export function recordCommentPerformanceSample({
  stage,
  duration,
  dimensions,
}: {
  stage: CommentPerformanceStage
  duration: number
  dimensions?: Partial<CommentPerformanceDimensions>
}) {
  if (!COMMENT_PERFORMANCE_STAGES.has(stage) || !Number.isFinite(duration) || duration < 0)
    return
  const normalizedDimensions = normalizeDimensions(dimensions)
  const key = bucketKey(stage, normalizedDimensions)
  const bucket = buckets.get(key) ?? {
    stage,
    dimensions: normalizedDimensions,
    durations: [],
  }
  bucket.durations.push(duration)
  if (bucket.durations.length > COMMENT_PERFORMANCE_WINDOW_SIZE)
    bucket.durations.splice(0, bucket.durations.length - COMMENT_PERFORMANCE_WINDOW_SIZE)
  buckets.set(key, bucket)
}

export function resetCommentPerformanceSamples() {
  buckets.clear()
}

export function getCommentPerformanceSnapshot(): CommentPerformanceSnapshotEntry[] {
  return Array.from(buckets.values(), (bucket) => {
    const sorted = [...bucket.durations].sort((left, right) => left - right)
    return {
      stage: bucket.stage,
      ...bucket.dimensions,
      count: sorted.length,
      windowSize: COMMENT_PERFORMANCE_WINDOW_SIZE,
      p50: percentile(sorted, 0.5),
      p95: percentile(sorted, 0.95),
      max: sorted.at(-1) ?? 0,
    }
  }).sort((left, right) => bucketKey(left.stage, left).localeCompare(bucketKey(right.stage, right)))
}

export function beginCommentPerformance(stage: CommentPerformanceStage) {
  const startedAt = performance.now()
  let requestCount = 0
  const clientDurations: Partial<Record<CommentBootstrapClientStage, number>> = {}
  const mergeClientDurations = (
    durations: Partial<Record<CommentBootstrapClientStage, number>>,
  ) => {
    for (const [name, duration] of Object.entries(durations)) {
      if (
        COMMENT_BOOTSTRAP_CLIENT_STAGES.has(name as CommentBootstrapClientStage)
        && Number.isFinite(duration)
        && duration >= 0
      ) {
        clientDurations[name as CommentBootstrapClientStage] = duration
      }
    }
  }
  return {
    countRequest() {
      requestCount += 1
    },
    mergeClientDurations,
    measureSync<T>(name: CommentBootstrapClientStage, operation: () => T): T {
      const operationStartedAt = performance.now()
      try {
        return operation()
      }
      finally {
        clientDurations[name] = performance.now() - operationStartedAt
      }
    },
    end(options: CommentPerformanceEndOptions = {}): CommentPerformanceSample {
      mergeClientDurations(options.telemetry?.clientDurations ?? {})
      const endedAt = performance.now()
      const duration = endedAt - startedAt
      const dimensions = dimensionsFromTelemetry(options.telemetry)
      const serverDurations = parseCommentServerTiming(options.serverTiming)
      const transportOverhead = clientDurations.fetch_headers === undefined
        ? null
        : calculateCommentTransportOverhead(clientDurations, serverDurations)
      recordCommentPerformanceSample({ stage, duration, dimensions })
      for (const [clientStage, clientDuration] of Object.entries(clientDurations)) {
        recordCommentPerformanceSample({
          stage: clientStage as CommentBootstrapClientStage,
          duration: clientDuration,
          dimensions,
        })
      }
      if (transportOverhead !== null) {
        recordCommentPerformanceSample({
          stage: 'transport_overhead',
          duration: transportOverhead,
          dimensions,
        })
      }
      const sample: CommentPerformanceSample = {
        stage,
        duration,
        requestCount,
        requestId: options.requestId,
        serverDurations,
        transportOverhead,
        responseBytes: options.telemetry?.responseBytes ?? null,
        dimensions,
        detail: options.detail,
      }
      if (import.meta.env.DEV) {
        performance.measure(`resume-comments:${stage}`, {
          start: startedAt,
          end: endedAt,
          detail: sample,
        })
      }
      return sample
    },
  }
}
