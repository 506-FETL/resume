import type { ResumeSchema } from './form'
import { z } from 'zod'
import {
  createLegacyResumeEntryId,
} from '../../../../supabase/functions/shared/resume-comment-core.ts'

export { createLegacyResumeEntryId }

export const resumeEntryIdSchema = z.string().trim().min(1).max(128)

export interface ResumeEntryIdPatch {
  sectionKey: ResumeEntryCollection['sectionKey']
  collectionKey: ResumeEntryCollection['collectionKey']
  index: number
  entryId: string
}

const RESUME_ENTRY_COLLECTIONS = [
  { sectionKey: 'edu_background', collectionKey: 'items' },
  { sectionKey: 'work_experience', collectionKey: 'items' },
  { sectionKey: 'internship_experience', collectionKey: 'items' },
  { sectionKey: 'campus_experience', collectionKey: 'items' },
  { sectionKey: 'project_experience', collectionKey: 'items' },
  { sectionKey: 'skill_specialty', collectionKey: 'skills' },
  { sectionKey: 'honors_certificates', collectionKey: 'certificates' },
  { sectionKey: 'hobbies', collectionKey: 'hobbies' },
] as const

type ResumeEntryCollection = (typeof RESUME_ENTRY_COLLECTIONS)[number]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readCollection(
  value: unknown,
  { sectionKey, collectionKey }: ResumeEntryCollection,
): unknown[] {
  if (!isRecord(value)) {
    return []
  }

  const section = value[sectionKey]
  if (!isRecord(section)) {
    return []
  }

  const collection = section[collectionKey]
  return Array.isArray(collection) ? collection : []
}

function readEntryId(value: unknown): string | null {
  if (!isRecord(value)) {
    return null
  }

  const parsed = resumeEntryIdSchema.safeParse(value.entryId)
  return parsed.success ? parsed.data : null
}

function withoutEntryId(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  const { entryId: _entryId, ...rest } = value
  return rest
}

function createUniqueLegacyEntryId(
  collection: ResumeEntryCollection,
  index: number,
  value: unknown,
  usedIds: Set<string>,
): string {
  const base = createLegacyResumeEntryId({
    sectionKey: collection.sectionKey,
    collectionKey: collection.collectionKey,
    index,
    value: withoutEntryId(value),
  })
  let candidate = base
  let suffix = 1

  while (usedIds.has(candidate)) {
    candidate = `${base}_${suffix}`
    suffix += 1
  }

  return candidate
}

export function createResumeEntryId(): string {
  return crypto.randomUUID()
}

function ensureCollectionEntryIds(
  resume: unknown,
  collection: ResumeEntryCollection,
) {
  const entries = readCollection(resume, collection)
  const usedIds = new Set<string>()

  entries.forEach((entry, index) => {
    if (!isRecord(entry)) {
      return
    }

    const existingId = readEntryId(entry)
    if (existingId && !usedIds.has(existingId)) {
      entry.entryId = existingId
      usedIds.add(existingId)
      return
    }

    const entryId = createUniqueLegacyEntryId(collection, index, entry, usedIds)
    entry.entryId = entryId
    usedIds.add(entryId)
  })
}

export function ensureResumeSectionEntryIds<K extends keyof ResumeSchema>(
  sectionKey: K,
  value: ResumeSchema[K],
): ResumeSchema[K] {
  const resume = { [sectionKey]: value }
  for (const collection of RESUME_ENTRY_COLLECTIONS) {
    if (collection.sectionKey === sectionKey) {
      ensureCollectionEntryIds(resume, collection)
    }
  }

  return value
}

export function ensureResumeEntryIds(resume: ResumeSchema): ResumeSchema {
  for (const collection of RESUME_ENTRY_COLLECTIONS) {
    ensureCollectionEntryIds(resume, collection)
  }

  return resume
}

export function hasCompleteResumeEntryIds(value: unknown): boolean {
  return RESUME_ENTRY_COLLECTIONS.every((collection) => {
    const usedIds = new Set<string>()

    return readCollection(value, collection).every((entry) => {
      const entryId = readEntryId(entry)
      if (!entryId || usedIds.has(entryId)) {
        return false
      }
      usedIds.add(entryId)
      return true
    })
  })
}

export function collectMissingResumeEntryIdPatches(
  source: unknown,
  normalized: ResumeSchema,
): ResumeEntryIdPatch[] {
  return RESUME_ENTRY_COLLECTIONS.flatMap((collection) => {
    const sourceEntries = readCollection(source, collection)
    const normalizedEntries = readCollection(normalized, collection)

    return normalizedEntries.flatMap((entry, index) => {
      const entryId = readEntryId(entry)
      const sourceEntry = sourceEntries[index]
      const sourceEntryId = isRecord(sourceEntry) ? sourceEntry.entryId : undefined

      if (!entryId || sourceEntryId === entryId) {
        return []
      }

      return [{
        sectionKey: collection.sectionKey,
        collectionKey: collection.collectionKey,
        index,
        entryId,
      }]
    })
  })
}

export function applyResumeEntryIdPatches(
  target: unknown,
  patches: ResumeEntryIdPatch[],
) {
  if (!isRecord(target)) {
    return
  }

  for (const patch of patches) {
    const section = target[patch.sectionKey]
    if (!isRecord(section)) {
      continue
    }

    const collection = section[patch.collectionKey]
    if (!Array.isArray(collection)) {
      continue
    }

    const entry = collection[patch.index]
    if (isRecord(entry)) {
      entry.entryId = patch.entryId
    }
  }
}
