import {
  deleteAccessibleResume,
  getAccessibleResumeMetadata,
  updateAccessibleResumeMeta,
} from '@/lib/resume-access'
import { useCurrentResumeStore } from '@/store/resume'
import useUserStore from '@/store/user'
import { requestConfirm } from '../../agent/confirm-bridge'
import { registerTool } from '../../agent/tool-registry'
import {
  RESUME_TYPES,
  bindResumeToActiveConversation,
  normalizeResumeType,
} from './resume-context'

registerTool({
  name: 'update_resume_meta',
  description:
    '修改某份简历的元信息（display_name 名称、description 描述）。resumeId 从 list_resumes 获得。此操作需用户确认。',
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
  policy: { scope: 'account', confirmation: 'required' },
  execute: async (args, context) => {
    const resumeId = String(args.resumeId ?? '')

    if (!resumeId) return { error: '缺少 resumeId' }

    const patch: Record<string, unknown> = {}

    if (typeof args.display_name === 'string')
      patch.display_name = args.display_name.trim()
    if (typeof args.description === 'string')
      patch.description = args.description.trim()
    if (Object.keys(patch).length === 0)
      return { error: '没有需要更新的字段（display_name / description）' }

    let current: Awaited<ReturnType<typeof getAccessibleResumeMetadata>>

    try {
      current = await getAccessibleResumeMetadata(resumeId)
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : '读取简历信息失败',
      }
    }

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

    return requestConfirm(
      {
        id: crypto.randomUUID(),
        toolName: 'update_resume_meta',
        preview: {
          kind: 'resume-field',
          title: '修改简历信息',
          before,
          after,
        },
        apply: async () => {
          const latest = await getAccessibleResumeMetadata(resumeId)

          if (
            Object.keys(patch).some(
              (key) =>
                latest[key as keyof typeof latest] !==
                current[key as keyof typeof current],
            )
          )
            return {
              error:
                '这些简历信息在等待确认时已被修改。请读取最新内容，重新生成差异并请用户确认。',
              conflict: true,
            }

          await updateAccessibleResumeMeta(resumeId, patch)

          return { ok: true, resumeId, before, after }
        },
      },
      context?.signal,
    )
  },
})

registerTool({
  name: 'delete_resume',
  description:
    '删除一份本地或云端简历。resumeId 从 list_resumes 获得。不可恢复，此操作需用户确认。',
  parameters: {
    type: 'object',
    properties: { resumeId: { type: 'string', description: '简历 resume_id' } },
    required: ['resumeId'],
    additionalProperties: false,
  },
  mode: 'write',
  policy: { scope: 'account', confirmation: 'required' },
  execute: async (args, context) => {
    const resumeId = String(args.resumeId ?? '')

    if (!resumeId) return { error: '缺少 resumeId' }

    let current: Awaited<ReturnType<typeof getAccessibleResumeMetadata>>

    try {
      current = await getAccessibleResumeMetadata(resumeId)
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : '读取简历信息失败',
      }
    }

    const displayName = String(current.display_name || '未命名简历')

    return requestConfirm(
      {
        id: crypto.randomUUID(),
        toolName: 'delete_resume',
        preview: {
          kind: 'resume-delete',
          title: '删除简历',
          summary: `将永久删除简历「${displayName}」及其全部内容，无法恢复。`,
        },
        apply: async () => {
          await deleteAccessibleResume(resumeId)

          // 若删除的是当前打开的简历，清空当前编辑态
          if (useCurrentResumeStore.getState().resumeId === resumeId)
            useCurrentResumeStore.getState().clearCurrentResume()

          return {
            ok: true,
            resumeId,
            before: `名称：${displayName}`,
            after: '',
          }
        },
      },
      context?.signal,
    )
  },
})

registerTool({
  name: 'open_resume',
  description:
    '在编辑器打开指定简历，使其成为「当前正在编辑」的简历（之后可用 update_current_resume_field 修改其模块）。resumeId 从 list_resumes 获得。此操作即时生效，无需确认。',
  parameters: {
    type: 'object',
    properties: {
      resumeId: { type: 'string', description: '简历 resume_id' },
      type: {
        type: 'string',
        enum: RESUME_TYPES,
        description: '简历类型（可选）',
      },
    },
    required: ['resumeId'],
    additionalProperties: false,
  },
  mode: 'read',
  policy: { scope: 'account', confirmation: 'none' },
  execute: async (args, context) => {
    const resumeId = String(args.resumeId ?? '')

    if (!resumeId) return { error: '缺少 resumeId' }

    try {
      const resume = await getAccessibleResumeMetadata(resumeId)
      const type = normalizeResumeType(resume.type ?? args.type)

      context?.signal?.throwIfAborted()

      if (
        context?.target &&
        useUserStore.getState().currentUser?.id !== context.target.ownerId
      )
        return { cancelled: true, message: '账户已改变，本轮不再打开简历。' }

      useCurrentResumeStore.getState().setCurrentResume(resumeId, type)
      bindResumeToActiveConversation(resumeId, context?.target)

      return { ok: true, resumeId, type, storage: resume.storage }
    } catch (error) {
      return { error: error instanceof Error ? error.message : '打开简历失败' }
    }
  },
})
