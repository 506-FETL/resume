import type { HistoryCurrentResume, HistoryResumeOption, HistoryVersionGroup, VersionMetadataDraft } from './types'
import type { ResumeHistoryOptionRecord, ResumeHistoryResumeRecord, ResumeHistoryVersionRecord, ResumeHistoryVersionRow, ResumeSnapshot } from '@/lib/supabase/resume/history'
import dayjs from 'dayjs'
import { DEFAULT_APPLICATION_INFO, DEFAULT_BASICS, DEFAULT_CAMPUS_EXPERIENCE, DEFAULT_EDU_BACKGROUND, DEFAULT_HOBBIES, DEFAULT_HONORS_CERTIFICATES, DEFAULT_INTERNSHIP_EXPERIENCE, DEFAULT_JOB_INTENT, DEFAULT_ORDER, DEFAULT_PROJECT_EXPERIENCE, DEFAULT_SELF_EVALUATION, DEFAULT_SKILL_SPECIALTY, DEFAULT_VISIBILITY, DEFAULT_WORK_EXPERIENCE, migrateOrder, migrateVisibility, normalizeResumeAppearance, normalizeResumeType, resolveResumeTemplateBinding } from '@/lib/schema'
import { RESUME_TYPE_LABEL_MAP } from './const'

interface SnapshotFieldConfig {
  default: unknown
  legacyKey?: string
}

type SnapshotSectionKey = Exclude<keyof ResumeSnapshot, 'order' | 'visibility' | 'type' | 'spacing' | 'font' | 'theme' | 'templateBinding'>

const SNAPSHOT_FIELD_DEFAULTS: Record<SnapshotSectionKey, SnapshotFieldConfig> = {
  basics: { default: DEFAULT_BASICS },
  job_intent: { default: DEFAULT_JOB_INTENT, legacyKey: 'jobIntent' },
  application_info: { default: DEFAULT_APPLICATION_INFO, legacyKey: 'applicationInfo' },
  edu_background: { default: DEFAULT_EDU_BACKGROUND, legacyKey: 'eduBackground' },
  work_experience: { default: DEFAULT_WORK_EXPERIENCE, legacyKey: 'workExperience' },
  internship_experience: { default: DEFAULT_INTERNSHIP_EXPERIENCE, legacyKey: 'internshipExperience' },
  campus_experience: { default: DEFAULT_CAMPUS_EXPERIENCE, legacyKey: 'campusExperience' },
  project_experience: { default: DEFAULT_PROJECT_EXPERIENCE, legacyKey: 'projectExperience' },
  skill_specialty: { default: DEFAULT_SKILL_SPECIALTY, legacyKey: 'skillSpecialty' },
  honors_certificates: { default: DEFAULT_HONORS_CERTIFICATES, legacyKey: 'honorsCertificates' },
  self_evaluation: { default: DEFAULT_SELF_EVALUATION, legacyKey: 'selfEvaluation' },
  hobbies: { default: DEFAULT_HOBBIES },
}

export function sanitizeDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => sanitizeDeep(item)) as T
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, sanitizeDeep(item)]),
    ) as T
  }

  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeTags(value: unknown): string[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,，]/g)
      : []

  return Array.from(
    new Set(
      source
        .map(item => String(item).trim())
        .filter(Boolean),
    ),
  )
}

function getSnapshotSectionValue<K extends SnapshotSectionKey>(
  key: K,
  sourceRecord?: Record<string, unknown>,
): ResumeSnapshot[K] {
  const { default: defaultValue, legacyKey } = SNAPSHOT_FIELD_DEFAULTS[key]
  const nextValue = sourceRecord?.[key] ?? (legacyKey ? sourceRecord?.[legacyKey] : undefined) ?? defaultValue
  return sanitizeDeep(nextValue) as ResumeSnapshot[K]
}

export function buildResumeSnapshot(source: unknown): ResumeSnapshot {
  const sourceRecord = isRecord(source) ? source : undefined
  const orderValue = Array.isArray(sourceRecord?.order) ? sourceRecord.order : DEFAULT_ORDER
  const visibilityValue = isRecord(sourceRecord?.visibility)
    ? sourceRecord.visibility as Record<string, boolean>
    : DEFAULT_VISIBILITY
  const type = normalizeResumeType(sourceRecord?.type)
  const templateBinding = resolveResumeTemplateBinding(
    (sourceRecord?.templateBinding ?? sourceRecord?.template_binding) as ResumeSnapshot['templateBinding'],
    type,
  )

  return {
    basics: getSnapshotSectionValue('basics', sourceRecord),
    job_intent: getSnapshotSectionValue('job_intent', sourceRecord),
    application_info: getSnapshotSectionValue('application_info', sourceRecord),
    edu_background: getSnapshotSectionValue('edu_background', sourceRecord),
    work_experience: getSnapshotSectionValue('work_experience', sourceRecord),
    internship_experience: getSnapshotSectionValue('internship_experience', sourceRecord),
    campus_experience: getSnapshotSectionValue('campus_experience', sourceRecord),
    project_experience: getSnapshotSectionValue('project_experience', sourceRecord),
    skill_specialty: getSnapshotSectionValue('skill_specialty', sourceRecord),
    honors_certificates: getSnapshotSectionValue('honors_certificates', sourceRecord),
    self_evaluation: getSnapshotSectionValue('self_evaluation', sourceRecord),
    hobbies: getSnapshotSectionValue('hobbies', sourceRecord),
    order: migrateOrder(orderValue as string[]),
    visibility: migrateVisibility(visibilityValue),
    type,
    templateBinding,
    ...normalizeResumeAppearance(sourceRecord),
  }
}

export function normalizeHistoryVersion(version: ResumeHistoryVersionRow): ResumeHistoryVersionRecord {
  return {
    ...version,
    tags: normalizeTags(version.tags),
    snapshot: buildResumeSnapshot(version.snapshot),
  }
}

export function buildCurrentResume(record: ResumeHistoryResumeRecord): HistoryCurrentResume {
  return {
    resumeId: record.resume_id,
    displayName: record.display_name?.trim() || '未命名简历',
    description: record.description?.trim() || '',
    updatedAt: record.updated_at,
    type: normalizeResumeType(record.type),
    snapshot: buildResumeSnapshot(record),
  }
}

export function buildHistoryResumeOption(record: ResumeHistoryOptionRecord): HistoryResumeOption {
  return {
    resumeId: record.resume_id,
    displayName: record.display_name?.trim() || '未命名简历',
    description: record.description?.trim() || '',
    updatedAt: record.updated_at,
    type: normalizeResumeType(record.type),
  }
}

export function getVersionTitle(version: ResumeHistoryVersionRecord) {
  return version.version_name?.trim() || `版本 V${version.version_no}`
}

export function getVersionSubtitle(version: ResumeHistoryVersionRecord) {
  if (version.milestone_name?.trim()) {
    return version.milestone_name.trim()
  }

  return `V${version.version_no}`
}

export function createMetadataDraft(version?: ResumeHistoryVersionRecord | null): VersionMetadataDraft {
  return {
    versionName: version?.version_name ?? '',
    milestoneName: version?.milestone_name ?? '',
    description: version?.description ?? '',
    tags: normalizeTags(version?.tags),
  }
}

export function applyMetadataDraftPatch(
  current: VersionMetadataDraft,
  patch: Partial<VersionMetadataDraft>,
): VersionMetadataDraft {
  return {
    ...current,
    ...patch,
    tags: patch.tags ? normalizeTags(patch.tags) : current.tags,
  }
}

export function toVersionMutationPayload(draft: VersionMetadataDraft) {
  return {
    version_name: trimToNull(draft.versionName),
    milestone_name: trimToNull(draft.milestoneName),
    description: trimToNull(draft.description),
    tags: normalizeTags(draft.tags),
  }
}

export function isMetadataDraftDirty(
  draft: VersionMetadataDraft,
  version: ResumeHistoryVersionRecord | null | undefined,
) {
  const left = JSON.stringify(normalizeDraft(draft))
  const right = JSON.stringify(normalizeDraft(createMetadataDraft(version)))
  return left !== right
}

export function groupVersionsByDay(versions: ResumeHistoryVersionRecord[]): HistoryVersionGroup[] {
  const groups = new Map<string, ResumeHistoryVersionRecord[]>()

  versions.forEach((version) => {
    const key = dayjs(version.created_at).format('YYYY-MM-DD')
    const current = groups.get(key) ?? []
    current.push(version)
    groups.set(key, current)
  })

  return Array.from(groups.entries()).map(([key, items]) => ({
    label: getDateGroupLabel(key),
    items,
  }))
}

export function trimToNull(value: string | null | undefined) {
  const nextValue = value?.trim()
  return nextValue || null
}

export function getDateGroupLabel(value: string) {
  const date = dayjs(value)

  if (date.isSame(dayjs(), 'day')) {
    return '今天'
  }

  if (date.isSame(dayjs().subtract(1, 'day'), 'day')) {
    return '昨天'
  }

  if (date.isSame(dayjs(), 'year')) {
    return date.format('M 月 D 日')
  }

  return date.format('YYYY 年 M 月 D 日')
}

export function getCurrentSyncState(currentResume: HistoryCurrentResume | null, versions: ResumeHistoryVersionRecord[]) {
  if (!currentResume || versions.length === 0) {
    return {
      latestVersionNo: null,
      synced: false,
    }
  }

  return {
    latestVersionNo: versions[0]?.version_no ?? null,
    synced: areSnapshotsEqual(currentResume.snapshot, versions[0]?.snapshot),
  }
}

export function getOrderedSections(snapshot: ResumeSnapshot): SnapshotSectionKey[] {
  const merged = ['basics', ...snapshot.order] as SnapshotSectionKey[]
  return Array.from(new Set(merged))
}

export function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => sortObjectKeys(item))
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortObjectKeys((value as Record<string, unknown>)[key])
        return result
      }, {})
  }

  return value
}

export function stableSerialize(value: unknown) {
  return JSON.stringify(sortObjectKeys(sanitizeDeep(value)))
}

export function areSnapshotsEqual(left: ResumeSnapshot, right?: ResumeSnapshot | null) {
  if (!right) {
    return false
  }

  return stableSerialize(left) === stableSerialize(right)
}

function normalizeDraft(draft: VersionMetadataDraft) {
  return {
    versionName: draft.versionName.trim(),
    milestoneName: draft.milestoneName.trim(),
    description: draft.description.trim(),
    tags: normalizeTags(draft.tags),
  }
}

export function getResumeTypeLabel(type: string | null | undefined): string {
  return RESUME_TYPE_LABEL_MAP[normalizeResumeType(type)]
}
