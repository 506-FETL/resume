import type { ResumeType } from '@/lib/schema'
import { createNewResume, createResumeHistoryVersion, createResumeSnapshotHash, deleteCompany, deleteResume, deleteResumeHistoryVersion, getCompanies, getResumeById, getResumeHistoryResume, listResumeHistoryVersions, restoreResumeHistoryVersion, updateResumeConfig } from '@/lib/supabase/resume'
import { buildResumeSnapshot, normalizeHistoryVersion } from '@/pages/history/utils'
import useTrackerStore from '@/pages/tracker/store'
import { FORM_DATA_KEYS, useCurrentResumeStore } from '@/store/resume'
import { requestConfirm } from '../agent/confirm-bridge'
import { registerTool } from '../agent/tool-registry'

// 简历「基础模板类型」的合法取值（与创建简历卡片一致）
const RESUME_TYPES: ResumeType[] = ['default', 'modern', 'simple']

function normalizeResumeType(value: unknown): ResumeType {
  return RESUME_TYPES.includes(value as ResumeType) ? (value as ResumeType) : 'default'
}

// 从模型给的 sections 里挑出合法模块列，作为 resume_config 的初始内容列写入。
// 简历正文首次打开时会以 resume_config 行的这些列 seed 到 Automerge 文档，因此可直接落库。
function pickSectionColumns(sections: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!sections || typeof sections !== 'object')
    return out
  for (const key of FORM_DATA_KEYS) {
    const value = (sections as Record<string, unknown>)[key]
    if (value !== undefined && value !== null)
      out[key] = value
  }
  return out
}

registerTool({
  name: 'create_resume',
  description: `新建一份完整简历。display_name 必填（简历名称）；type 可选（default/modern/simple）；sections 可选，为各模块初始内容对象，键可含：${FORM_DATA_KEYS.join(', ')}。留空则创建空白简历。创建后会自动在编辑器打开。此操作需用户确认。`,
  parameters: {
    type: 'object',
    properties: {
      display_name: { type: 'string', description: '简历名称' },
      description: { type: 'string', description: '简历描述（可选）' },
      type: { type: 'string', enum: RESUME_TYPES, description: '基础模板类型（可选，默认 default）' },
      sections: { type: 'object', description: `各模块初始内容（可选）。键可含：${FORM_DATA_KEYS.join(', ')}` },
    },
    required: ['display_name'],
    additionalProperties: false,
  },
  mode: 'write',
  execute: async (args) => {
    const displayName = String(args.display_name ?? '').trim()
    if (!displayName)
      return { error: '新建简历需要 display_name（简历名称）' }

    const type = normalizeResumeType(args.type)
    const sectionColumns = pickSectionColumns(args.sections)
    const filledKeys = Object.keys(sectionColumns)
    const summary = filledKeys.length
      ? `「${displayName}」（${type}），预填模块：${filledKeys.join('、')}`
      : `「${displayName}」（${type}），空白简历`

    return requestConfirm({
      id: crypto.randomUUID(),
      toolName: 'create_resume',
      preview: {
        kind: 'resume-create',
        title: '新建简历',
        summary,
      },
      apply: async () => {
        const created = await createNewResume(
          { display_name: displayName, description: args.description ? String(args.description) : undefined },
          type,
        )
        const resumeId = (created as { resume_id: string }).resume_id
        // 有初始内容时写入 section 列，首次打开会 seed 进正文文档
        if (filledKeys.length)
          await updateResumeConfig(resumeId, sectionColumns)
        // 自动在编辑器打开新简历
        useCurrentResumeStore.getState().setCurrentResume(resumeId, type)
        // 统一红绿 diff：新建 → before 为空，after 为简历名称/描述
        const afterLines = [`名称：${displayName}`]
        if (args.description)
          afterLines.push(`描述：${String(args.description)}`)
        if (filledKeys.length)
          afterLines.push(`预填模块：${filledKeys.join('、')}`)
        return { ok: true, resumeId, opened: true, before: '', after: afterLines.join('\n') }
      },
    })
  },
})

registerTool({
  name: 'update_resume_meta',
  description: '修改某份简历的元信息（display_name 名称、description 描述）。resumeId 从 list_resumes 获得。此操作需用户确认。',
  parameters: {
    type: 'object',
    properties: {
      resumeId: { type: 'string', description: '简历 resume_id' },
      display_name: { type: 'string', description: '新的简历名称（可选）' },
      description: { type: 'string', description: '新的简历描述（可选）' },
    },
    required: ['resumeId'],
    additionalProperties: false,
  },
  mode: 'write',
  execute: async (args) => {
    const resumeId = String(args.resumeId ?? '')
    if (!resumeId)
      return { error: '缺少 resumeId' }

    const patch: Record<string, unknown> = {}
    if (typeof args.display_name === 'string')
      patch.display_name = args.display_name.trim()
    if (typeof args.description === 'string')
      patch.description = args.description.trim()
    if (Object.keys(patch).length === 0)
      return { error: '没有需要更新的字段（display_name / description）' }

    // 读取当前元信息作为「变更前」，避免 before 为空
    const current = await getResumeById<{ display_name?: string, description?: string }>(
      resumeId,
      'display_name, description',
    ).catch(() => ({} as { display_name?: string, description?: string }))

    const beforeParts: string[] = []
    const afterParts: string[] = []
    if (patch.display_name !== undefined) {
      beforeParts.push(`名称：${current.display_name || '（空）'}`)
      afterParts.push(`名称：${(patch.display_name as string) || '（空）'}`)
    }
    if (patch.description !== undefined) {
      beforeParts.push(`描述：${current.description || '（空）'}`)
      afterParts.push(`描述：${(patch.description as string) || '（空）'}`)
    }
    const before = beforeParts.join('\n')
    const after = afterParts.join('\n')

    return requestConfirm({
      id: crypto.randomUUID(),
      toolName: 'update_resume_meta',
      preview: {
        kind: 'resume-field',
        title: '修改简历信息',
        before,
        after,
      },
      apply: async () => {
        await updateResumeConfig(resumeId, patch)
        return { ok: true, resumeId, before, after }
      },
    })
  },
})

registerTool({
  name: 'delete_resume',
  description: '删除一份简历（含其云端内容）。resumeId 从 list_resumes 获得。不可恢复，此操作需用户确认。',
  parameters: {
    type: 'object',
    properties: { resumeId: { type: 'string', description: '简历 resume_id' } },
    required: ['resumeId'],
    additionalProperties: false,
  },
  mode: 'write',
  execute: async (args) => {
    const resumeId = String(args.resumeId ?? '')
    if (!resumeId)
      return { error: '缺少 resumeId' }

    return requestConfirm({
      id: crypto.randomUUID(),
      toolName: 'delete_resume',
      preview: {
        kind: 'resume-delete',
        title: '删除简历',
        summary: `将永久删除简历（resumeId=${resumeId}）及其全部内容，无法恢复。`,
      },
      apply: async () => {
        // 删除前读取名称，生成统一红绿 diff（整体删除为红色）
        const current = await getResumeById<{ display_name?: string }>(resumeId, 'display_name')
          .catch(() => ({} as { display_name?: string }))
        await deleteResume(resumeId, 'resume_id')
        // 若删除的是当前打开的简历，清空当前编辑态
        if (useCurrentResumeStore.getState().resumeId === resumeId)
          useCurrentResumeStore.getState().clearCurrentResume()
        return { ok: true, resumeId, before: `名称：${current.display_name || resumeId}`, after: '' }
      },
    })
  },
})

registerTool({
  name: 'open_resume',
  description: '在编辑器打开指定简历，使其成为「当前正在编辑」的简历（之后可用 update_current_resume_field 修改其模块）。resumeId 从 list_resumes 获得。此操作即时生效，无需确认。',
  parameters: {
    type: 'object',
    properties: {
      resumeId: { type: 'string', description: '简历 resume_id' },
      type: { type: 'string', enum: RESUME_TYPES, description: '简历类型（可选）' },
    },
    required: ['resumeId'],
    additionalProperties: false,
  },
  mode: 'read',
  execute: async (args) => {
    const resumeId = String(args.resumeId ?? '')
    if (!resumeId)
      return { error: '缺少 resumeId' }
    useCurrentResumeStore.getState().setCurrentResume(resumeId, normalizeResumeType(args.type))
    return { ok: true, resumeId }
  },
})

registerTool({
  name: 'save_current_resume_version',
  description: '把「当前正在编辑」的简历保存为一个历史版本快照。versionName/description 可选。仅当已在编辑器打开云端简历时可用。此操作需用户确认。',
  parameters: {
    type: 'object',
    properties: {
      versionName: { type: 'string', description: '版本名称（可选）' },
      description: { type: 'string', description: '版本说明（可选）' },
    },
    additionalProperties: false,
  },
  mode: 'write',
  execute: async (args) => {
    const resumeId = useCurrentResumeStore.getState().resumeId
    if (!resumeId)
      return { error: '当前没有打开任何简历。请先在编辑器打开要保存版本的简历。' }

    return requestConfirm({
      id: crypto.randomUUID(),
      toolName: 'save_current_resume_version',
      preview: {
        kind: 'version-save',
        title: '保存历史版本',
        summary: args.versionName ? `保存为版本「${String(args.versionName)}」` : '保存当前简历为一个新的历史版本',
      },
      apply: async () => {
        const record = await getResumeHistoryResume(resumeId)
        const snapshot = buildResumeSnapshot(record)
        const created = await createResumeHistoryVersion({
          resume_id: resumeId,
          version_name: args.versionName ? String(args.versionName) : null,
          description: args.description ? String(args.description) : null,
          source_type: 'manual',
          snapshot,
          content_hash: await createResumeSnapshotHash(snapshot),
          base_updated_at: record.updated_at,
        })
        return { ok: true, versionNo: created.version_no }
      },
    })
  },
})

registerTool({
  name: 'restore_current_resume_version',
  description: '把「当前正在编辑」的简历恢复到某个历史版本（默认会先备份当前内容）。versionId 从 list_resume_versions 获得（即版本记录的 id）。仅当已在编辑器打开该简历时可用。此操作需用户确认。',
  parameters: {
    type: 'object',
    properties: {
      versionId: { type: 'number', description: '要恢复到的版本记录 id' },
      backup: { type: 'boolean', description: '恢复前是否备份当前内容（默认 true）' },
    },
    required: ['versionId'],
    additionalProperties: false,
  },
  mode: 'write',
  execute: async (args) => {
    const resumeId = useCurrentResumeStore.getState().resumeId
    if (!resumeId)
      return { error: '当前没有打开任何简历。请先在编辑器打开要恢复的简历。' }

    const versionId = Number(args.versionId)
    if (!Number.isFinite(versionId))
      return { error: 'versionId 必须是数字' }

    const versions = await listResumeHistoryVersions(resumeId).catch(() => [])
    const rawTarget = versions.find(v => v.id === versionId)
    if (!rawTarget)
      return { error: '未在当前简历下找到该版本' }
    const target = normalizeHistoryVersion(rawTarget)

    const strategy = args.backup === false ? 'without_backup' : 'with_backup'

    return requestConfirm({
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
        await restoreResumeHistoryVersion({
          resumeId,
          targetVersion: target,
          currentSnapshot,
          currentUpdatedAt: record.updated_at,
          strategy,
        })
        return { ok: true, restoredFrom: target.version_no }
      },
    })
  },
})

registerTool({
  name: 'delete_resume_version',
  description: '删除某个历史版本。versionId 从 list_resume_versions 获得（版本记录的 id）。不可恢复，此操作需用户确认。',
  parameters: {
    type: 'object',
    properties: { versionId: { type: 'number', description: '版本记录 id' } },
    required: ['versionId'],
    additionalProperties: false,
  },
  mode: 'write',
  execute: async (args) => {
    const versionId = Number(args.versionId)
    if (!Number.isFinite(versionId))
      return { error: 'versionId 必须是数字' }

    return requestConfirm({
      id: crypto.randomUUID(),
      toolName: 'delete_resume_version',
      preview: {
        kind: 'version-delete',
        title: '删除历史版本',
        summary: `将永久删除版本记录（id=${versionId}），无法恢复。`,
      },
      apply: async () => {
        await deleteResumeHistoryVersion(versionId)
        return { ok: true, versionId }
      },
    })
  },
})

registerTool({
  name: 'delete_job',
  description: '删除求职看板中的某个职位。jobId 从 list_jobs 获得。不可恢复，此操作需用户确认。',
  parameters: {
    type: 'object',
    properties: { jobId: { type: 'string', description: '职位 id' } },
    required: ['jobId'],
    additionalProperties: false,
  },
  mode: 'write',
  execute: async (args) => {
    const jobId = String(args.jobId ?? '')
    if (!jobId)
      return { error: '缺少 jobId' }

    const jobs = await getCompanies().catch(() => [])
    const job = jobs.find(j => j.id === jobId)
    if (!job)
      return { error: '未找到该职位' }

    return requestConfirm({
      id: crypto.randomUUID(),
      toolName: 'delete_job',
      preview: {
        kind: 'job-delete',
        title: '删除职位',
        summary: `将永久删除职位「${job.company} · ${job.position}」，无法恢复。`,
      },
      apply: async () => {
        await deleteCompany(jobId)
        useTrackerStore.getState().removeJobs([jobId])
        // 统一红绿 diff：删除 → before 为职位信息，after 为空（整体删除为红色）
        const beforeLines = [`公司：${job.company}`, `岗位：${job.position}`]
        if (job.location)
          beforeLines.push(`城市：${job.location}`)
        return { ok: true, jobId, before: beforeLines.join('\n'), after: '' }
      },
    })
  },
})
