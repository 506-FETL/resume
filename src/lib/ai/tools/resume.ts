import type { z } from 'zod'
import { resolveActiveResumeId } from '@/lib/ai/active-resume'
import { getAccessibleResumeById, listAccessibleResumes } from '@/lib/resume-access'
import { normalizeResumeSection, resumeSchema } from '@/lib/schema'
import { applyResumeFieldToDocument, FORM_DATA_KEYS } from '@/store/resume'
import { requestConfirm } from '../agent/confirm-bridge'
import { registerTool } from '../agent/tool-registry'

registerTool({
  name: 'list_resumes',
  description: '列出当前用户可访问的所有本地和云端简历（名称、类型、存储位置、派生状态）。当用户问有哪些简历、想对比/选择简历时使用。',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  mode: 'read',
  execute: async () => {
    try {
      const rows = await listAccessibleResumes()
      if (rows.length === 0)
        return { count: 0, message: '用户还没有任何简历' }
      return {
        count: rows.length,
        resumes: rows.map(r => ({
          resumeId: r.resume_id,
          name: r.display_name ?? '未命名',
          type: r.type ?? 'unknown',
          storage: r.storage,
          derivedStatus: r.derived_status ?? null,
        })),
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
      return await getAccessibleResumeById(String(args.resumeId))
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

// 把 zod 校验错误整理成给模型看的简明中文提示
function formatSectionIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map(i => `${i.path.join('.') || '(根)'}：${i.message}`)
    .join('；')
}

registerTool({
  name: 'update_current_resume_field',
  description: `修改「本对话正在操作」的简历的某个模块内容。仅当本对话已用 open_resume/create_resume 绑定某份简历时可用。sectionKey 可选值：${FORM_DATA_KEYS.join(', ')}。value 为该模块的新内容对象，其字段结构必须严格匹配 system 中「简历模块字段结构」的说明（特别注意：列表字段是对象数组而非字符串数组；时间字段是长度为 2 的字符串数组；enum 只能取给定值）。此操作需用户确认。`,
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
    const currentId = resolveActiveResumeId()
    if (!currentId)
      return { error: '当前对话还没有绑定简历。请先在本对话里用 open_resume 打开要修改的简历，再让我修改。' }

    const sectionKey = String(args.sectionKey) as (typeof FORM_DATA_KEYS)[number]
    if (!FORM_DATA_KEYS.includes(sectionKey))
      return { error: `无效的模块键：${sectionKey}` }

    // 助手页未必挂载编辑器，必须直接读取目标数据源，不能用共享 store 的默认表单作为修改基线。
    let current: Record<string, unknown>
    try {
      current = await getAccessibleResumeById(currentId)
    }
    catch (error) {
      return { error: error instanceof Error ? error.message : '读取当前简历失败' }
    }
    const before = current[sectionKey]

    // value 必须是对象；以完整模块内容为基线合并本次改动，再按该模块的字段结构（zod schema）校验，
    // 拒绝结构错误的写入（如把技能写成空对象/字符串数组），避免简历渲染成一排空标签。
    const rawValue = args.value
    if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue))
      return { error: `value 必须是【${SECTION_LABELS[sectionKey] ?? sectionKey}】模块的内容对象` }

    const merged = { ...(before as Record<string, unknown> | null ?? {}), ...(rawValue as Record<string, unknown>) }
    const normalized = normalizeResumeSection(sectionKey, merged)
    const parsed = resumeSchema.shape[sectionKey].safeParse(normalized)
    if (!parsed.success) {
      return {
        error: `写入【${SECTION_LABELS[sectionKey] ?? sectionKey}】的数据不符合该模块的字段结构约束，已拒绝写入：${formatSectionIssues(parsed.error)}。请先用 get_resume_detail 查看该模块的现有结构，再严格按相同结构重新提供 value。`,
      }
    }
    // 使用校验并规范化（去空格、补默认值）后的完整模块内容
    const after = parsed.data

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
        // 经编辑器 store 写入 Automerge 文档并落库，保证编辑器与画布一致
        await applyResumeFieldToDocument(currentId, sectionKey, after as Record<string, unknown>)
        return { ok: true, resumeId: currentId, sectionKey, before, after }
      },
    })
  },
})
