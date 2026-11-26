import type {
  RestoreResumeHistoryVersionInput,
  ResumeHistoryVersionRow,
  ResumeHistoryOptionRecord,
  ResumeSnapshot,
} from './types'
import { createResumeHistoryVersion } from './queries'
import { createResumeSnapshotHash, trimToNull } from './snapshot'

export async function restoreResumeHistoryVersion(
  {
    resumeId,
    targetVersion,
    targetSnapshot,
    currentSnapshot,
    currentContentHash,
    currentUpdatedAt,
    strategy,
  }: RestoreResumeHistoryVersionInput,
  progress?: {
    backupSaved: (record: ResumeHistoryVersionRow) => void
    currentSaved: (
      record: ResumeHistoryOptionRecord,
      snapshot: ResumeSnapshot,
      contentHash: string,
    ) => void
  },
) {
  const { replaceAutomergeDocumentSnapshot } =
    await import('@/lib/automerge/document/sync')

  if (strategy === 'with_backup') {
    const backup = await createResumeHistoryVersion({
      resume_id: resumeId,
      version_name: '恢复前备份',
      description: `恢复到 V${targetVersion.version_no} 前自动保存`,
      source_type: 'autosave',
      tags: ['恢复前备份'],
      snapshot: currentSnapshot,
      content_hash:
        currentContentHash ?? (await createResumeSnapshotHash(currentSnapshot)),
      base_updated_at: currentUpdatedAt,
    })

    progress?.backupSaved(backup)
  }

  const { snapshot: restoredSnapshot, record } =
    await replaceAutomergeDocumentSnapshot(resumeId, targetSnapshot)

  const contentHash = await createResumeSnapshotHash(restoredSnapshot)

  progress?.currentSaved(record, restoredSnapshot, contentHash)

  return createResumeHistoryVersion({
    resume_id: resumeId,
    version_name: `从 V${targetVersion.version_no} 恢复`,
    description: trimToNull(
      targetVersion.version_name
        ? `从「${targetVersion.version_name}」恢复当前内容`
        : `从 V${targetVersion.version_no} 恢复当前内容`,
    ),
    milestone_name: trimToNull(targetVersion.milestone_name),
    source_type: 'restore',
    tags: targetVersion.tags ?? [],
    snapshot: restoredSnapshot,
    content_hash: contentHash,
    base_updated_at: currentUpdatedAt,
  })
}
