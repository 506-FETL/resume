import { createNewResume, updateResumeConfig } from '@/lib/supabase/resume'
import useAssistantStore from '@/pages/assistant/store'
import { FORM_DATA_KEYS, useCurrentResumeStore } from '@/store/resume'
import useUserStore from '@/store/user'
import { requestConfirm } from '../../agent/confirm-bridge'
import { registerTool } from '../../agent/tool-registry'
import {
  RESUME_TYPES,
  bindResumeToActiveConversation,
  normalizeResumeType,
  pickSectionColumns,
} from './resume-context'

registerTool({
  name: 'create_resume',
  description: `新建一份完整简历。display_name 必填（简历名称）；type 可选（default/modern/simple）；sections 可选，为各模块初始内容对象，键可含：${FORM_DATA_KEYS.join(', ')}。留空则创建空白简历。创建后会自动在编辑器打开。此操作需用户确认。`,
  parameters: {
    type: 'object',
    properties: {
      display_name: { type: 'string', description: '简历名称' },
      description: { type: 'string', description: '简历描述（可选）' },
      type: {
        type: 'string',
        enum: RESUME_TYPES,
        description: '兼容类型值（可选，默认 default；均使用默认模板呈现）',
      },
      sections: {
        type: 'object',
        description: `各模块初始内容（可选）。键可含：${FORM_DATA_KEYS.join(', ')}`,
      },
    },
    required: ['display_name'],
    additionalProperties: false,
  },
  mode: 'write',
  policy: { scope: 'account', confirmation: 'required' },
  execute: async (args, context) => {
    const displayName = String(args.display_name ?? '').trim()
    const ownerId = useUserStore.getState().currentUser?.id

    const conversationId =
      context?.target?.conversationId ??
      useAssistantStore.getState().activeConversationId

    if (!displayName) return { error: '新建简历需要 display_name（简历名称）' }
    if (!ownerId) return { error: '请先登录后创建简历。' }

    const type = normalizeResumeType(args.type)
    const sectionColumns = pickSectionColumns(args.sections)
    const filledKeys = Object.keys(sectionColumns)

    const summary = filledKeys.length
      ? `「${displayName}」（${type}），预填模块：${filledKeys.join('、')}`
      : `「${displayName}」（${type}），空白简历`

    return requestConfirm(
      {
        id: crypto.randomUUID(),
        toolName: 'create_resume',
        preview: {
          kind: 'resume-create',
          title: '新建简历',
          summary,
        },
        apply: async () => {
          const created = await createNewResume(
            {
              display_name: displayName,
              description: args.description
                ? String(args.description)
                : undefined,
            },
            type,
          )

          const resumeId = (created as { resume_id: string }).resume_id

          if (useUserStore.getState().currentUser?.id !== ownerId)
            return {
              ok: true,
              resumeId,
              opened: false,
              before: '',
              after: `名称：${displayName}`,
              message:
                '简历已在原账户创建。登录状态已改变，未继续预填或切换当前简历。',
            }

          // 有初始内容时写入 section 列，首次打开会 seed 进正文文档
          if (filledKeys.length)
            await updateResumeConfig(resumeId, sectionColumns)

          const opened =
            useUserStore.getState().currentUser?.id === ownerId &&
            !context?.signal?.aborted &&
            useAssistantStore.getState().activeConversationId === conversationId

          if (opened)
            useCurrentResumeStore.getState().setCurrentResume(resumeId, type)

          bindResumeToActiveConversation(resumeId, context?.target)

          // 统一红绿 diff：新建 → before 为空，after 为简历名称/描述
          const afterLines = [`名称：${displayName}`]

          if (args.description)
            afterLines.push(`描述：${String(args.description)}`)
          if (filledKeys.length)
            afterLines.push(`预填模块：${filledKeys.join('、')}`)

          return {
            ok: true,
            resumeId,
            opened,
            before: '',
            after: afterLines.join('\n'),
          }
        },
      },
      context?.signal,
    )
  },
})
