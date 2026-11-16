import type { CommentBootstrapClientStage } from '../client.ts'
import {
  bucketKey,
  COMMENT_BOOTSTRAP_CLIENT_STAGES,
  COMMENT_PERFORMANCE_STAGES,
  dimensionsFromTelemetry,
  normalizeDimensions,
} from './dimensions'
import {
  calculateCommentTransportOverhead,
  parseCommentServerTiming,
} from './server-timing'
import type {
  CommentPerformanceDimensions,
  CommentPerformanceEndOptions,
  CommentPerformanceSample,
  CommentPerformanceSnapshotEntry,
  CommentPerformanceStage,
} from './types'

export const COMMENT_PERFORMANCE_WINDOW_SIZE = 50 as const

export interface CommentPerformanceBucket {
  dimensions: CommentPerformanceDimensions
  stage: CommentPerformanceStage
  durations: number[]
}

export const buckets = new Map<string, CommentPerformanceBucket>()

export function percentile(sorted: number[], ratio: number) {
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)] ?? 0
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
  if (
    !COMMENT_PERFORMANCE_STAGES.has(stage) ||
    !Number.isFinite(duration) ||
    duration < 0
  )
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
    bucket.durations.splice(
      0,
      bucket.durations.length - COMMENT_PERFORMANCE_WINDOW_SIZE,
    )

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
  }).sort((left, right) =>
    bucketKey(left.stage, left).localeCompare(bucketKey(right.stage, right)),
  )
}

export function beginCommentPerformance(stage: CommentPerformanceStage) {
  const startedAt = performance.now()
  let requestCount = 0

  const clientDurations: Partial<Record<CommentBootstrapClientStage, number>> =
    {}

  const mergeClientDurations = (
    durations: Partial<Record<CommentBootstrapClientStage, number>>,
  ) => {
    for (const [name, duration] of Object.entries(durations)) {
      if (
        COMMENT_BOOTSTRAP_CLIENT_STAGES.has(
          name as CommentBootstrapClientStage,
        ) &&
        Number.isFinite(duration) &&
        duration >= 0
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
      } finally {
        clientDurations[name] = performance.now() - operationStartedAt
      }
    },
    end(options: CommentPerformanceEndOptions = {}): CommentPerformanceSample {
      mergeClientDurations(options.telemetry?.clientDurations ?? {})

      const endedAt = performance.now()
      const duration = endedAt - startedAt
      const dimensions = dimensionsFromTelemetry(options.telemetry)
      const serverDurations = parseCommentServerTiming(options.serverTiming)

      const transportOverhead =
        clientDurations.fetch_headers === undefined
          ? null
          : calculateCommentTransportOverhead(clientDurations, serverDurations)

      recordCommentPerformanceSample({ stage, duration, dimensions })

      for (const [clientStage, clientDuration] of Object.entries(
        clientDurations,
      )) {
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
