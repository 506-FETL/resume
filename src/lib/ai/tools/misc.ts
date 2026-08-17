import { isOfflineResumeId } from '@/lib/offline-resume-manager'
import { fetchVariantTree, getAtsFromUserId, listResumeHistoryVersionSummaries } from '@/lib/supabase/resume'
import { listUserTemplates } from '@/lib/supabase/template'
import { getUserProfile } from '@/lib/supabase/user'
import { registerTool } from '../agent/tool-registry'

registerTool({
  name: 'get_current_time',
  description: '获取当前日期和时间（用户本地时区）。',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  mode: 'read',
  execute: async () => ({ now: new Date().toLocaleString('zh-CN') }),
})

registerTool({
  name: 'get_user_profile',
  description: '获取当前登录用户的资料（昵称、邮箱等）。',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  mode: 'read',
  execute: async () => {
    try {
      return (await getUserProfile()) ?? { message: '无用户资料' }
    }
    catch (error) {
      return { error: error instanceof Error ? error.message : '读取用户资料失败' }
    }
  },
})

registerTool({
  name: 'get_ats',
  description: '获取指定简历的 ATS 评分与优化建议。resumeId 从 list_resumes 获得；不传则返回全部 ATS 记录。',
  parameters: {
    type: 'object',
    properties: { resumeId: { type: 'string', description: '简历 resume_id（可选）' } },
    additionalProperties: false,
  },
  mode: 'read',
  execute: async (args) => {
    const resumeId = typeof args.resumeId === 'string' ? args.resumeId : null
    if (resumeId && isOfflineResumeId(resumeId))
      return { error: '本地简历暂不支持 ATS 评估记录，请先同步到云端。' }

    try {
      const all = (await getAtsFromUserId()) as unknown as Array<Record<string, unknown>>
      const filtered = resumeId ? all.filter(a => a.resume_id === resumeId) : all
      if (!filtered || filtered.length === 0)
        return { message: '该简历还没有 ATS 评估记录' }
      return { count: filtered.length, records: filtered }
    }
    catch (error) {
      return { error: error instanceof Error ? error.message : '读取 ATS 失败' }
    }
  },
})

registerTool({
  name: 'get_variant_tree',
  description: '获取某份简历的 JD 派生血缘树（原始简历与其针对不同岗位的派生版本）。resumeId 从 list_resumes 获得。',
  parameters: {
    type: 'object',
    properties: { resumeId: { type: 'string', description: '简历 resume_id' } },
    required: ['resumeId'],
    additionalProperties: false,
  },
  mode: 'read',
  execute: async (args) => {
    const resumeId = String(args.resumeId)
    if (isOfflineResumeId(resumeId))
      return { error: '本地简历暂不支持派生血缘，请先同步到云端。' }

    try {
      return await fetchVariantTree(resumeId)
    }
    catch (error) {
      return { error: error instanceof Error ? error.message : '读取派生血缘失败' }
    }
  },
})

registerTool({
  name: 'list_templates',
  description: '列出当前用户的简历模板。',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  mode: 'read',
  execute: async () => {
    try {
      const list = (await listUserTemplates()) as unknown as Array<Record<string, unknown>>
      return { count: list.length, templates: list.map(t => ({ id: t.template_id, name: t.name, description: t.description })) }
    }
    catch (error) {
      return { error: error instanceof Error ? error.message : '读取模板失败' }
    }
  },
})

registerTool({
  name: 'list_resume_versions',
  description: '列出指定简历的历史版本摘要。resumeId 从 list_resumes 获得；不传返回全部。',
  parameters: {
    type: 'object',
    properties: { resumeId: { type: 'string', description: '简历 resume_id（可选）' } },
    additionalProperties: false,
  },
  mode: 'read',
  execute: async (args) => {
    const resumeId = typeof args.resumeId === 'string' ? args.resumeId : null
    if (resumeId && isOfflineResumeId(resumeId))
      return { error: '本地简历暂不支持历史版本，请先同步到云端。' }

    try {
      const all = (await listResumeHistoryVersionSummaries()) as unknown as Array<Record<string, unknown>>
      const filtered = resumeId ? all.filter(v => v.resume_id === resumeId) : all
      return { count: filtered.length, versions: filtered }
    }
    catch (error) {
      return { error: error instanceof Error ? error.message : '读取历史版本失败' }
    }
  },
})
