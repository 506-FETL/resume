import type { CursorEventPayload, RealtimeCursorMap } from './types'

export function upsertRealtimeCursor(
  cursors: RealtimeCursorMap,
  payload: CursorEventPayload,
): RealtimeCursorMap {
  return {
    ...cursors,
    [payload.user.id]: payload,
  }
}

export function upsertRealtimeCursorBatch(
  cursors: RealtimeCursorMap,
  payloads: CursorEventPayload[],
): RealtimeCursorMap {
  if (payloads.length === 0) {
    return cursors
  }

  const next = { ...cursors }

  payloads.forEach((payload) => {
    next[payload.user.id] = payload
  })

  return next
}

export function removeRealtimeCursor(
  cursors: RealtimeCursorMap,
  userId: number,
): RealtimeCursorMap {
  if (!(userId in cursors)) {
    return cursors
  }

  const next = { ...cursors }
  delete next[userId]
  return next
}

export function projectRealtimeCursor(
  payload: CursorEventPayload,
  projectPoint: (
    point: CursorEventPayload['position'],
    viewport: CursorEventPayload['viewport'],
  ) => CursorEventPayload['position'],
): CursorEventPayload {
  return {
    ...payload,
    position: projectPoint(payload.position, payload.viewport),
  }
}
