import type { ExperienceStore } from './types'

export const pending = new Map<string, Promise<unknown>>()

export const unknownDeletions = new Set<string>()

export const metadataQueue = new Set<string>()

export function sourceRequestKey(
  state: Pick<ExperienceStore, 'generation' | 'revision'>,
  operation: 'list' | 'read',
  key: string,
) {
  return `${state.generation}:${state.revision}:${operation}:${key}`
}

export function sourceReadKey(
  sourceId: string,
  versionId?: string,
  offset = 0,
  blockIds?: string[],
  limit = 20,
) {
  return JSON.stringify([sourceId, versionId, offset, blockIds, limit])
}
