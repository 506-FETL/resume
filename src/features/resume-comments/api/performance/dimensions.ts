import type {
  CommentBootstrapClientStage,
  CommentResponseTelemetry,
} from '../client.ts'
import type {
  CommentPerformanceAuthMode,
  CommentPerformanceDimensions,
  CommentPerformanceEdgeRegion,
  CommentPerformanceStage,
} from './types'

export const COMMENT_PERFORMANCE_STAGES = new Set<CommentPerformanceStage>([
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

export const COMMENT_BOOTSTRAP_CLIENT_STAGES =
  new Set<CommentBootstrapClientStage>([
    'auth_token',
    'fetch_headers',
    'response_body',
    'normalize',
    'store_commit',
    'realtime_connect',
  ])

export const COMMENT_AUTH_MODES = new Set<CommentPerformanceAuthMode>([
  'anonymous',
  'local_jwks',
  'legacy_auth',
  'unknown',
  'not_applicable',
])

export const COMMENT_EDGE_REGIONS = new Set<CommentPerformanceEdgeRegion>([
  'unknown',
  'us-east-1',
  'ap-northeast-2',
  'other',
])

export function normalizeEdgeRegion(
  value: string | null | undefined,
): CommentPerformanceEdgeRegion {
  if (!value) return 'unknown'
  if (value === 'us-east-1' || value === 'ap-northeast-2') return value

  return 'other'
}

export function normalizeDimensions(
  value: Partial<CommentPerformanceDimensions> = {},
): CommentPerformanceDimensions {
  const authMode = COMMENT_AUTH_MODES.has(value.authMode ?? 'not_applicable')
    ? (value.authMode ?? 'not_applicable')
    : 'unknown'

  const edgeRegion = COMMENT_EDGE_REGIONS.has(value.edgeRegion ?? 'unknown')
    ? (value.edgeRegion ?? 'unknown')
    : 'other'

  return {
    authMode,
    coldStart:
      typeof value.coldStart === 'boolean' ? value.coldStart : 'unknown',
    repair: typeof value.repair === 'boolean' ? value.repair : 'unknown',
    protocolVersion: value.protocolVersion === 1 ? 1 : 'unknown',
    edgeRegion,
  }
}

export function dimensionsFromTelemetry(
  telemetry?: CommentResponseTelemetry | null,
): CommentPerformanceDimensions {
  if (!telemetry) return normalizeDimensions()

  return normalizeDimensions({
    authMode: telemetry.authMode,
    coldStart: telemetry.coldStart,
    repair: telemetry.repair,
    protocolVersion: telemetry.protocolVersion,
    edgeRegion: normalizeEdgeRegion(telemetry.edgeRegion),
  })
}

export function bucketKey(
  stage: CommentPerformanceStage,
  dimensions: CommentPerformanceDimensions,
) {
  return JSON.stringify([
    stage,
    dimensions.authMode,
    dimensions.coldStart,
    dimensions.repair,
    dimensions.protocolVersion,
    dimensions.edgeRegion,
  ])
}
