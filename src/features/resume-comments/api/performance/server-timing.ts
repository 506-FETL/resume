import type { CommentBootstrapClientStage } from '../client.ts'
import type { CommentServerDurations, CommentServerTimingName } from './types'

export const COMMENT_SERVER_TIMING_NAMES = new Set<CommentServerTimingName>([
  'auth_anonymous',
  'auth_local',
  'auth_legacy',
  'access_token',
  'access_rpc',
  'mutation_rpc',
  'replay',
  'rate_limit',
  'write_rpc',
  'hydrate',
  'rpc',
  'repair',
  'realtime_token',
  'serialize',
  'edge_total',
  'total',
])

export function parseCommentServerTiming(
  value?: string | null,
): CommentServerDurations {
  if (!value) return {}

  const durations: CommentServerDurations = {}

  for (const entry of value.split(',')) {
    const [rawName, ...parameters] = entry.trim().split(';')
    const name = rawName?.trim() as CommentServerTimingName

    if (!COMMENT_SERVER_TIMING_NAMES.has(name) || durations[name] !== undefined)
      continue

    const durationParameter = parameters.find((parameter) =>
      parameter.trim().startsWith('dur='),
    )

    const durationText = durationParameter?.trim().slice(4).trim() ?? ''

    if (!durationText) continue

    const duration = Number(durationText)

    if (!Number.isFinite(duration) || duration < 0) continue

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
    (clientDurations.fetch_headers ?? 0) -
      (serverDurations.edge_total ?? serverDurations.total ?? 0),
  )
}
