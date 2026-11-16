import type {
  CommentAuthMode,
  CommentBootstrapClientStage,
  CommentResponseTelemetry,
} from '../client.ts'

export type CommentPerformanceStage =
  | 'cache'
  | 'bootstrap'
  | 'source'
  | 'mutation'
  | 'realtime_recovery'
  | CommentBootstrapClientStage
  | 'transport_overhead'

export type CommentPerformanceAuthMode =
  | CommentAuthMode
  | 'unknown'
  | 'not_applicable'

export type CommentPerformanceBoolean = boolean | 'unknown'

export type CommentPerformanceProtocolVersion = 1 | 'unknown'

export type CommentPerformanceEdgeRegion =
  | 'unknown'
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

export type CommentServerTimingName =
  | 'auth_anonymous'
  | 'auth_local'
  | 'auth_legacy'
  | 'access_token'
  | 'access_rpc'
  | 'mutation_rpc'
  | 'replay'
  | 'rate_limit'
  | 'write_rpc'
  | 'hydrate'
  | 'rpc'
  | 'repair'
  | 'realtime_token'
  | 'serialize'
  | 'edge_total'
  | 'total'

export type CommentServerDurations = Partial<
  Record<CommentServerTimingName, number>
>

export interface CommentPerformanceSample {
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

export interface CommentPerformanceEndOptions {
  requestId?: string | null
  serverTiming?: string | null
  telemetry?: CommentResponseTelemetry | null
  detail?: Record<string, string | number | boolean>
}
