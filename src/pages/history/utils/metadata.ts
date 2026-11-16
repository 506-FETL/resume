import type { VersionMetadataDraft } from '../types'
import type { ResumeHistoryVersionListItem } from '@/lib/supabase/resume/history'
import { normalizeTags } from './snapshot'

export function createMetadataDraft(
  version?: ResumeHistoryVersionListItem | null,
): VersionMetadataDraft {
  return {
    versionName: version?.version_name ?? '',
    milestoneName: version?.milestone_name ?? '',
    description: version?.description ?? '',
    tags: normalizeTags(version?.tags),
    companyId: version?.company_id ?? null,
    submittedAt: version?.submitted_at ?? null,
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
    company_id: draft.companyId || null,
    submitted_at: draft.submittedAt || null,
  }
}

export function isMetadataDraftDirty(
  draft: VersionMetadataDraft,
  version: ResumeHistoryVersionListItem | null | undefined,
) {
  const left = JSON.stringify(normalizeDraft(draft))
  const right = JSON.stringify(normalizeDraft(createMetadataDraft(version)))

  return left !== right
}

export function trimToNull(value: string | null | undefined) {
  const nextValue = value?.trim()

  return nextValue || null
}

export function normalizeDraft(draft: VersionMetadataDraft) {
  return {
    versionName: draft.versionName.trim(),
    milestoneName: draft.milestoneName.trim(),
    description: draft.description.trim(),
    tags: normalizeTags(draft.tags),
    companyId: draft.companyId ?? null,
    submittedAt: draft.submittedAt ?? null,
  }
}
