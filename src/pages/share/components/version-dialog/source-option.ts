import type { ResumeHistoryShareOption } from '@/lib/supabase/resume/history/queries/resumes'
import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import { getShareVersionOption } from '@/lib/supabase/resume/share/option-pages'
import type { VersionDialogSelection } from '../../types'
import { shareReadGeneration } from '../../store/data/requests'

const checks = new Map<string, ReturnType<typeof getShareVersionOption>>()

export function checkShareVersionOption(
  ownerId: string,
  resumeId: string,
  versionId: number,
) {
  const key = JSON.stringify([
    shareReadGeneration,
    ownerId,
    resumeId,
    versionId,
  ])

  const pending = checks.get(key)

  if (pending) return pending

  const request = getShareVersionOption(ownerId, resumeId, versionId).finally(
    () => checks.delete(key),
  )

  checks.set(key, request)

  return request
}

function getVersionLabel(version: ResumeHistoryShareOption) {
  return (
    version.version_name?.trim() ||
    version.milestone_name?.trim() ||
    '未命名版本'
  )
}

export function getDeletedSelection(
  versionId: number,
  version: ResumeHistoryShareOption | null,
  share: ResumeShareRecord,
): VersionDialogSelection | null {
  if (version?.id === versionId) {
    return {
      kind: 'deleted-history',
      versionNo: version.version_no,
      versionLabel: getVersionLabel(version),
      versionCreatedAt: version.created_at,
    }
  }

  if (share.source.kind === 'history' && share.source.versionId === versionId) {
    return {
      kind: 'deleted-history',
      versionNo: share.source.versionNo,
      versionLabel: share.source.versionLabel,
      versionCreatedAt: share.source.versionCreatedAt,
    }
  }

  return null
}
