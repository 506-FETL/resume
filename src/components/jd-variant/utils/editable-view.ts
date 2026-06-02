import type { EditableResumeView } from '../types'
import type { PersistedResumeSnapshot } from '@/lib/schema'

interface SnapshotLike {
  basics?: { name?: unknown }
  job_intent?: { jobIntent?: unknown }
  skill_specialty?: { description?: unknown }
  self_evaluation?: { content?: unknown }
  work_experience?: { items?: Array<{ workInfo?: unknown }> }
  internship_experience?: { items?: Array<{ internshipInfo?: unknown }> }
  project_experience?: { items?: Array<{ projectInfo?: unknown, projectName?: unknown }> }
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

export function buildEditableView(snapshot: PersistedResumeSnapshot): EditableResumeView {
  const s = snapshot as unknown as SnapshotLike
  const view: EditableResumeView = {}

  // basics: schema has no `summary`; surface name/role hint via `summary` slot is intentional skip.
  // We expose nothing for basics if no summary-like field exists.

  const jobIntent = asString(s.job_intent?.jobIntent)
  if (jobIntent) {
    view.job_intent = { id: 'whole', content: jobIntent }
  }

  const skillContent = asString(s.skill_specialty?.description)
  if (skillContent) {
    view.skill_specialty = { id: 'whole', content: skillContent }
  }

  const selfEval = asString(s.self_evaluation?.content)
  if (selfEval) {
    view.self_evaluation = { id: 'whole', content: selfEval }
  }

  const workItems = getItems<{ workInfo?: unknown }>(s.work_experience)
  if (workItems.length > 0) {
    view.work_experience = workItems.map((w, idx) => ({
      id: String(idx),
      description: asString(w.workInfo),
    }))
  }

  const internItems = getItems<{ internshipInfo?: unknown }>(s.internship_experience)
  if (internItems.length > 0) {
    view.internship_experience = internItems.map((w, idx) => ({
      id: String(idx),
      description: asString(w.internshipInfo),
    }))
  }

  const projectItems = getItems<{ projectInfo?: unknown }>(s.project_experience)
  if (projectItems.length > 0) {
    view.project_experience = projectItems.map((p, idx) => ({
      id: String(idx),
      description: asString(p.projectInfo),
    }))
  }

  const campusItems = getItems<{ campusInfo?: unknown }>(s.campus_experience)
  if (campusItems.length > 0) {
    view.campus_experience = campusItems.map((c, idx) => ({
      id: String(idx),
      description: asString(c.campusInfo),
    }))
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
  for (const w of getItems<{ internshipInfo?: unknown }>(s.internship_experience)) {
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

export function computeMatchRate(keywords: string[], snapshot: PersistedResumeSnapshot): number {
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
