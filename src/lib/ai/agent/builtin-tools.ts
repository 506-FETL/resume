import { getAllResumesFromUser } from '@/lib/supabase/resume'
import { registerTool } from './tool-registry'

registerTool({
  name: 'get_current_time',
  description: '获取当前日期和时间（用户本地时区）。当用户询问现在几点、今天日期时使用。',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  execute: async () => {
    return { now: new Date().toLocaleString('zh-CN') }
  },
})

registerTool({
  name: 'get_resume_summary',
  description: '获取当前登录用户的简历列表摘要（数量、名称、类型）。当用户询问自己的简历情况时使用。',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  execute: async () => {
    try {
      const resumes = (await getAllResumesFromUser()) as Array<{ display_name?: string, type?: string }> | null
      if (!resumes || resumes.length === 0)
        return { count: 0, message: '用户还没有任何简历' }
      return {
        count: resumes.length,
        resumes: resumes.map(r => ({ name: r.display_name ?? '未命名', type: r.type ?? 'unknown' })),
      }
    }
    catch (error) {
      // 只读失败不 throw 出循环，返回可读错误给模型
      return { error: error instanceof Error ? error.message : '读取简历失败' }
    }
  },
})
