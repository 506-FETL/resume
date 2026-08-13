type CommentPerformanceStage = 'cache' | 'bootstrap' | 'source' | 'mutation' | 'realtime_recovery'

interface CommentPerformanceSample {
  stage: CommentPerformanceStage
  duration: number
  requestCount: number
  requestId?: string | null
}

const aggregates = new Map<CommentPerformanceStage, { count: number, total: number }>()

export function beginCommentPerformance(stage: CommentPerformanceStage) {
  const startedAt = performance.now()
  let requestCount = 0
  return {
    countRequest() {
      requestCount += 1
    },
    end(requestId?: string | null): CommentPerformanceSample {
      const duration = performance.now() - startedAt
      const aggregate = aggregates.get(stage) ?? { count: 0, total: 0 }
      aggregate.count += 1
      aggregate.total += duration
      aggregates.set(stage, aggregate)
      const sample = { stage, duration, requestCount, requestId }
      if (import.meta.env.DEV) {
        console.warn('[resume-comments:performance]', {
          ...sample,
          average: aggregate.total / aggregate.count,
        })
      }
      return sample
    },
  }
}
