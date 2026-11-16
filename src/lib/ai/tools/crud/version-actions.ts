import { resolveActiveResumeId } from '@/lib/ai/active-resume'
import { isOfflineResumeId } from '@/lib/offline-resume-manager'
import {
  createResumeHistoryVersion,
  createResumeSnapshotHash,
  deleteResumeHistoryVersion,
  getResumeHistoryResume,
  getResumeHistoryVersionSnapshot,
  listResumeHistoryVersions,
  restoreResumeHistoryVersion,
} from '@/lib/supabase/resume'
import {
  buildResumeSnapshot,
  normalizeHistoryVersionListItem,
} from '@/pages/history/utils'
import { requestConfirm } from '../../agent/confirm-bridge'
import { registerTool } from '../../agent/tool-registry'

registerTool({
  name: 'save_current_resume_version',
  description:
    '把「当前正在编辑」的简历保存为一个历史版本快照。versionName/description 可选。仅当已在编辑器打开云端简历时可用。此操作需用户确认。',
  parameters: {
    type: 'object',
    properties: {
      versionName: { type: 'string', description: '版本名称（可选）' },
      description: { type: 'string', description: '版本说明（可选）' },
    },
    additionalProperties: false,
  },
  mode: 'write',
  policy: { scope: 'target-resume', confirmation: 'required' },
  execute: async (args, context) => {
    const resumeId = context?.target
      ? context.target.resumeId
      : resolveActiveResumeId()

    if (!resumeId)
      return {
        error:
          '当前对话还没有绑定简历。请先在本对话里用 open_resume 打开要保存版本的简历。',
      }
    if (isOfflineResumeId(resumeId))
      return { error: '本地简历暂不支持历史版本，请先同步到云端。' }

    return requestConfirm(
      {
        id: crypto.randomUUID(),
        toolName: 'save_current_resume_version',
        preview: {
          kind: 'version-save',
          title: '保存历史版本',
          summary: args.versionName
            ? `保存为版本「${String(args.versionName)}」`
            : '保存当前简历为一个新的历史版本',
        },
        apply: async () => {
          const record = await getResumeHistoryResume(resumeId)
          const snapshot = buildResumeSnapshot(record)

          const created = await createResumeHistoryVersion({
            resume_id: resumeId,
            version_name: args.versionName ? String(args.versionName) : null,
            description: args.description ? String(args.description) : null,
            source_type: 'ai_optimize',
            snapshot,
            content_hash: await createResumeSnapshotHash(snapshot),
            base_updated_at: record.updated_at,
          })

          return { ok: true, resumeId, versionNo: created.version_no }
        },
      },
      context?.signal,
    )
  },
})

registerTool({
  name: 'restore_current_resume_version',
  description:
    '把「本对话正在操作」的简历恢复到某个历史版本（默认会先备份当前内容）。versionId 从 list_resume_versions 获得（即版本记录的 id）。仅当本对话已绑定该简历时可用。此操作需用户确认。',
  parameters: {
    type: 'object',
    properties: {
      versionId: { type: 'number', description: '要恢复到的版本记录 id' },
      backup: {
        type: 'boolean',
        description: '恢复前是否备份当前内容（默认 true）',
      },
    },
    required: ['versionId'],
    additionalProperties: false,
  },
  mode: 'write',
  policy: { scope: 'target-resume', confirmation: 'required' },
  execute: async (args, context) => {
    const resumeId = context?.target
      ? context.target.resumeId
      : resolveActiveResumeId()

    if (!resumeId)
      return {
        error:
          '当前对话还没有绑定简历。请先在本对话里用 open_resume 打开要恢复的简历。',
      }
    if (isOfflineResumeId(resumeId))
      return { error: '本地简历暂不支持历史版本，请先同步到云端。' }

    const versionId = Number(args.versionId)

    if (!Number.isFinite(versionId)) return { error: 'versionId 必须是数字' }

    const versions = await listResumeHistoryVersions(resumeId).catch(() => [])
    const rawTarget = versions.find((v) => v.id === versionId)

    if (!rawTarget) return { error: '未在当前简历下找到该版本' }

    const target = normalizeHistoryVersionListItem(rawTarget)

    const strategy = args.backup === false ? 'without_backup' : 'with_backup'

    return requestConfirm(
      {
        id: crypto.randomUUID(),
        toolName: 'restore_current_resume_version',
        preview: {
          kind: 'version-restore',
          title: '恢复历史版本',
          summary: `恢复到 V${target.version_no}${strategy === 'with_backup' ? '（恢复前自动备份当前内容）' : '（不备份，直接覆盖）'}`,
        },
        apply: async () => {
          const record = await getResumeHistoryResume(resumeId)
          const currentSnapshot = buildResumeSnapshot(record)

          const targetSnapshot = buildResumeSnapshot(
            await getResumeHistoryVersionSnapshot(versionId),
          )

          await restoreResumeHistoryVersion({
            resumeId,
            targetVersion: target,
            targetSnapshot,
            currentSnapshot,
            currentUpdatedAt: record.updated_at,
            strategy,
          })

          return { ok: true, resumeId, restoredFrom: target.version_no }
        },
      },
      context?.signal,
    )
  },
})

registerTool({
  name: 'delete_resume_version',
  description:
    '删除某个历史版本。versionId 从 list_resume_versions 获得（版本记录的 id）。不可恢复，此操作需用户确认。',
  parameters: {
    type: 'object',
    properties: { versionId: { type: 'number', description: '版本记录 id' } },
    required: ['versionId'],
    additionalProperties: false,
  },
  mode: 'write',
  policy: { scope: 'account', confirmation: 'required' },
  execute: async (args, context) => {
    const versionId = Number(args.versionId)

    if (!Number.isFinite(versionId)) return { error: 'versionId 必须是数字' }

    // 尽力把这次删除归属到本对话绑定的简历，供画布按简历隔离变更记录
    const resumeId = context?.target
      ? context.target.resumeId
      : resolveActiveResumeId()

    return requestConfirm(
      {
        id: crypto.randomUUID(),
        toolName: 'delete_resume_version',
        preview: {
          kind: 'version-delete',
          title: '删除历史版本',
          summary: `将永久删除版本记录（id=${versionId}），无法恢复。`,
        },
        apply: async () => {
          await deleteResumeHistoryVersion(versionId)

          return { ok: true, resumeId: resumeId ?? undefined, versionId }
        },
      },
      context?.signal,
    )
  },
})
