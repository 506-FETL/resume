import type { AiMessagePart } from '@/lib/ai/types'
import { ToolCallsSection } from '@/components/ui/tool-calls-section'

type ToolCallPart = Extract<AiMessagePart, { type: 'tool-call' }>

interface ToolCallPartProps {
  calls: ToolCallPart[]
}

// 工具名 → { 展示分类(决定图标/配色), 中文标题 }。分类取自 tool-icons 内置 category。
const TOOL_META: Record<string, { category: string, label: string }> = {
  list_resumes: { category: 'documents', label: '读取简历列表' },
  get_resume_detail: { category: 'documents', label: '读取简历内容' },
  update_current_resume_field: { category: 'todos', label: '修改简历' },
  create_resume: { category: 'documents', label: '新建简历' },
  update_resume_meta: { category: 'todos', label: '修改简历信息' },
  delete_resume: { category: 'todos', label: '删除简历' },
  open_resume: { category: 'documents', label: '打开简历' },
  save_current_resume_version: { category: 'reminders', label: '保存历史版本' },
  restore_current_resume_version: { category: 'reminders', label: '恢复历史版本' },
  delete_resume_version: { category: 'reminders', label: '删除历史版本' },
  list_jobs: { category: 'goal_tracking', label: '读取求职看板' },
  get_job: { category: 'goal_tracking', label: '读取职位详情' },
  update_job: { category: 'goal_tracking', label: '修改职位' },
  create_job: { category: 'goal_tracking', label: '新增职位' },
  delete_job: { category: 'goal_tracking', label: '删除职位' },
  get_ats: { category: 'development', label: '读取 ATS 评分' },
  get_variant_tree: { category: 'memory', label: '读取派生血缘' },
  list_templates: { category: 'creative', label: '读取模板' },
  list_resume_versions: { category: 'reminders', label: '读取历史版本' },
  get_user_profile: { category: 'general', label: '读取用户资料' },
  get_current_time: { category: 'reminders', label: '获取当前时间' },
}

export function ToolCallPartGroup({ calls }: ToolCallPartProps) {
  const entries = calls.map((c) => {
    const meta = TOOL_META[c.toolName] ?? { category: 'general', label: c.toolName }
    return {
      tool_name: meta.label,
      tool_category: meta.category,
      tool_call_id: c.toolCallId,
      inputs: (c.args ?? {}) as Record<string, unknown>,
      output: c.result === undefined ? '' : JSON.stringify(c.result),
      show_category: false,
    }
  })
  return <ToolCallsSection toolCalls={entries} />
}
