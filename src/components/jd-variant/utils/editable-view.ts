import type { EditableResumeView } from '../types'
import type { PersistedResumeSnapshot } from '@/lib/schema'
import { VARIANT_FIELD_MAPPINGS } from '@/lib/schema'

interface SnapshotLike {
  basics?: { name?: unknown }
  job_intent?: { jobIntent?: unknown }
  skill_specialty?: { description?: unknown }
  self_evaluation?: { content?: unknown }
  work_experience?: { items?: Array<{ workInfo?: unknown }> }
  internship_experience?: { items?: Array<{ internshipInfo?: unknown }> }
  project_experience?: {
    items?: Array<{ projectInfo?: unknown; projectName?: unknown }>
  }
  campus_experience?: { items?: Array<{ campusInfo?: unknown }> }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function getItems<T>(value: unknown): T[] {
  if (!value || typeof value !== 'object') {
    return []
  }
  const items = (value as { items?: unknown }).items
  return Array.isArray(items) ? (items as T[]) : []
}

export function buildEditableView(
  snapshot: PersistedResumeSnapshot,
): EditableResumeView {
  const view: Record<string, unknown> = {}
  for (const [section, mapping] of Object.entries(VARIANT_FIELD_MAPPINGS)) {
    const current = snapshot[section as keyof typeof VARIANT_FIELD_MAPPINGS]
    if (mapping.collection) {
      const items = getItems<Record<string, unknown>>(current)
      if (items.length === 0) {
        continue
      }
      const ids = new Set<string>()
      view[section] = items.map((item) => {
        const id = asString(item.entryId)
        if (!id || ids.has(id)) {
          throw new Error(
            `JD 改写条目缺少稳定 entryId 或 entryId 重复：${section}`,
          )
        }
        ids.add(id)
        return {
          id,
          [mapping.fieldPath]: asString(item[mapping.snapshotField]),
        }
      })
    } else {
      const content = asString(
        (current as Record<string, unknown> | undefined)?.[
          mapping.snapshotField
        ],
      )
      if (content) {
        view[section] = { id: 'whole', [mapping.fieldPath]: content }
      }
    }
  }

  return view
}

function flattenSnapshotText(snapshot: PersistedResumeSnapshot): string {
  const s = snapshot as unknown as SnapshotLike
  const parts: string[] = []

  parts.push(asString(s.job_intent?.jobIntent) ?? '')
  parts.push(asString(s.skill_specialty?.description) ?? '')
  parts.push(asString(s.self_evaluation?.content) ?? '')

  for (const w of getItems<{ workInfo?: unknown }>(s.work_experience)) {
    parts.push(asString(w.workInfo) ?? '')
  }
  for (const w of getItems<{ internshipInfo?: unknown }>(
    s.internship_experience,
  )) {
    parts.push(asString(w.internshipInfo) ?? '')
  }
  for (const p of getItems<{ projectInfo?: unknown }>(s.project_experience)) {
    parts.push(asString(p.projectInfo) ?? '')
  }
  for (const c of getItems<{ campusInfo?: unknown }>(s.campus_experience)) {
    parts.push(asString(c.campusInfo) ?? '')
  }

  return parts.filter(Boolean).join('\n').toLowerCase()
}

export function computeMatchRate(
  keywords: string[],
  snapshot: PersistedResumeSnapshot,
): number {
  if (!Array.isArray(keywords) || keywords.length === 0) {
    return 0
  }
  const text = flattenSnapshotText(snapshot)
  let hit = 0
  for (const k of keywords) {
    if (!k) {
      continue
    }
    if (text.includes(k.toLowerCase())) {
      hit += 1
    }
  }
  return hit / keywords.length
}

export function formatJdSnippet(jdText: string, max = 30): string {
  const cleaned = jdText.replace(/\s+/g, ' ').trim()
  return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned
}
