import { getAllResumesFromUser, getResumeById, updateResumeConfig } from '@/lib/supabase/resume'
import { FORM_DATA_KEYS, useCurrentResumeStore, useResumeStore } from '@/store/resume'
import { requestConfirm } from '../agent/confirm-bridge'
import { registerTool } from '../agent/tool-registry'

registerTool({
  name: 'list_resumes',
  description: '列出当前用户的所有简历（名称、类型、派生状态）。当用户问有哪些简历、想对比/选择简历时使用。',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  mode: 'read',
  execute: async () => {
    try {
      const rows = (await getAllResumesFromUser()) as Array<Record<string, unknown>> | null
      if (!rows || rows.length === 0)
        return { count: 0, message: '用户还没有任何简历' }
      return {
        count: rows.length,
        resumes: rows.map(r => ({ resumeId: r.resume_id, name: r.display_name ?? '未命名', type: r.type ?? 'unknown', derivedStatus: r.derived_status ?? null })),
      }
    }
    catch (error) {
      return { error: error instanceof Error ? error.message : '读取简历列表失败' }
    }
  },
})

registerTool({
  name: 'get_resume_detail',
  description: '读取指定简历的完整内容（基本信息、工作/项目/实习/校园经历、技能、教育、自我评价等所有模块）。对比简历、评价简历、按简历回答时必须先调用它获取内容。resumeId 从 list_resumes 获得。',
  parameters: {
    type: 'object',
    properties: { resumeId: { type: 'string', description: '简历的 resume_id' } },
    required: ['resumeId'],
    additionalProperties: false,
  },
  mode: 'read',
  execute: async (args) => {
    try {
      const data = await getResumeById(String(args.resumeId), '*')
      if (!data)
        return { error: '未找到该简历' }
      return data
    }
    catch (error) {
      return { error: error instanceof Error ? error.message : '读取简历内容失败' }
    }
  },
})

// 简历模块中文名（用于确认卡标题与工具描述）
const SECTION_LABELS: Record<string, string> = {
  basics: '基本信息',
  job_intent: '求职意向',
  application_info: '应聘信息',
  edu_background: '教育背景',
  work_experience: '工作经历',
  internship_experience: '实习经历',
  campus_experience: '校园经历',
  project_experience: '项目经历',
  skill_specialty: '技能特长',
  honors_certificates: '荣誉证书',
  self_evaluation: '自我评价',
  hobbies: '兴趣爱好',
}

registerTool({
  name: 'update_current_resume_field',
  description: `修改「当前正在编辑」的简历的某个模块内容。仅当用户已在编辑器打开某份简历时可用。sectionKey 可选值：${FORM_DATA_KEYS.join(', ')}。value 为该模块的新内容对象（结构需与该模块一致）。此操作需用户确认。`,
  parameters: {
    type: 'object',
    properties: {
      sectionKey: { type: 'string', enum: [...FORM_DATA_KEYS], description: '要修改的简历模块键' },
      value: { type: 'object', description: '该模块的新内容（对象）' },
    },
    required: ['sectionKey', 'value'],
    additionalProperties: false,
  },
  mode: 'write',
  execute: async (args) => {
    const currentId = useCurrentResumeStore.getState().resumeId
    if (!currentId)
      return { error: '当前没有打开任何简历。请先在编辑器打开要修改的简历，再让我修改。' }

    const sectionKey = String(args.sectionKey) as (typeof FORM_DATA_KEYS)[number]
    if (!FORM_DATA_KEYS.includes(sectionKey))
      return { error: `无效的模块键：${sectionKey}` }

    // 「变更前」以 DB 为准（助手页可能未加载编辑器内存态），回退到内存态
    const dbRow = await getResumeById<Record<string, unknown>>(currentId, sectionKey).catch(() => null)
    const before = dbRow?.[sectionKey] ?? useResumeStore.getState().getResumeFormData()[sectionKey]
    const after = args.value

    return requestConfirm({
      id: crypto.randomUUID(),
      toolName: 'update_current_resume_field',
      preview: {
        kind: 'resume-field',
        title: `修改【${SECTION_LABELS[sectionKey] ?? sectionKey}】`,
        sectionKey,
        before,
        after,
      },
      apply: async () => {
        await updateResumeConfig(currentId, { [sectionKey]: after })
        return { ok: true, sectionKey, before, after }
      },
    })
  },
})
