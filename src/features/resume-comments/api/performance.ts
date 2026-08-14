type CommentPerformanceStage = 'cache' | 'bootstrap' | 'source' | 'mutation' | 'realtime_recovery'

interface CommentPerformanceSample {
  stage: CommentPerformanceStage
  duration: number
  requestCount: number
  requestId?: string | null
  targetMs: number
  warningMs: number
  serverDurations: Record<string, number>
  clientOverhead: number | null
  detail?: Record<string, string | number | boolean>
}

interface CommentPerformanceEndOptions {
  requestId?: string | null
  serverTiming?: string | null
  detail?: Record<string, string | number | boolean>
}

const performanceBudgets: Record<
  CommentPerformanceStage,
  { targetMs: number, warningMs: number }
> = {
  cache: { targetMs: 100, warningMs: 200 },
  bootstrap: { targetMs: 2_000, warningMs: 2_500 },
  source: { targetMs: 1_000, warningMs: 1_500 },
  mutation: { targetMs: 1_500, warningMs: 2_500 },
  realtime_recovery: { targetMs: 1_000, warningMs: 2_000 },
}

const aggregates = new Map<CommentPerformanceStage, { count: number, total: number }>()

export function parseCommentServerTiming(value?: string | null) {
  if (!value)
    return {}
  return Object.fromEntries(value.split(',').flatMap((entry) => {
    const [name, ...parameters] = entry.trim().split(';')
    const durationParameter = parameters.find(parameter => parameter.trim().startsWith('dur='))
    const duration = Number(durationParameter?.trim().slice(4))
    return name && Number.isFinite(duration) ? [[name, duration] as const] : []
  }))
}

export function classifyCommentPerformance(
  stage: CommentPerformanceStage,
  duration: number,
) {
  const budget = performanceBudgets[stage]
  return {
    ...budget,
    level: duration > budget.warningMs
      ? 'slow'
      : duration > budget.targetMs
        ? 'near_target'
        : 'normal',
  } as const
}

export function beginCommentPerformance(stage: CommentPerformanceStage) {
  const startedAt = performance.now()
  let requestCount = 0
  return {
    countRequest() {
      requestCount += 1
    },
    end(options: CommentPerformanceEndOptions = {}): CommentPerformanceSample {
      const endedAt = performance.now()
      const duration = endedAt - startedAt
      const aggregate = aggregates.get(stage) ?? { count: 0, total: 0 }
      aggregate.count += 1
      aggregate.total += duration
      aggregates.set(stage, aggregate)
      const classification = classifyCommentPerformance(stage, duration)
      const serverDurations = parseCommentServerTiming(options.serverTiming)
      const clientOverhead = serverDurations.total == null
        ? null
        : Math.max(0, duration - serverDurations.total)
      const sample = {
        stage,
        duration,
        requestCount,
        requestId: options.requestId,
        targetMs: classification.targetMs,
        warningMs: classification.warningMs,
        serverDurations,
        clientOverhead,
        detail: options.detail,
      }
      if (import.meta.env.DEV) {
        const report = {
          ...sample,
          average: aggregate.total / aggregate.count,
          level: classification.level,
        }
        performance.measure(`resume-comments:${stage}`, {
          start: startedAt,
          end: endedAt,
          detail: report,
        })
        if (classification.level === 'slow')
          console.warn('[resume-comments:performance]', report)
      }
      return sample
    },
  }
}
