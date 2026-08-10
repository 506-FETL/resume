import type { RestoreResumeHistoryVersionInput } from './types'
import { replaceAutomergeDocumentSnapshot } from '@/lib/automerge'
import { createResumeHistoryVersion } from './queries'
import { createResumeSnapshotHash, trimToNull } from './snapshot'

export async function restoreResumeHistoryVersion({
  resumeId,
  targetVersion,
  targetSnapshot,
  currentSnapshot,
  currentUpdatedAt,
  strategy,
}: RestoreResumeHistoryVersionInput) {
  if (strategy === 'with_backup') {
    await createResumeHistoryVersion({
      resume_id: resumeId,
      version_name: '恢复前备份',
      description: `恢复到 V${targetVersion.version_no} 前自动保存`,
      source_type: 'autosave',
      tags: ['恢复前备份'],
      snapshot: currentSnapshot,
      content_hash: await createResumeSnapshotHash(currentSnapshot),
      base_updated_at: currentUpdatedAt,
    })
  }

  const restoredSnapshot = await replaceAutomergeDocumentSnapshot(resumeId, targetSnapshot)

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
    content_hash: await createResumeSnapshotHash(restoredSnapshot),
    base_updated_at: currentUpdatedAt,
  })
}
