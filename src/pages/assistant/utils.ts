import type { CanvasChange, CanvasChangeAction, CanvasChangeCategory, CanvasModel } from './types'
import type { AiConversation, AiMessage, AiMessagePart } from '@/lib/ai/types'
import { computeLineDiff, diffStat } from './components/diff/compute-line-diff'
import { ASSISTANT_LAST_CONVERSATION_STORAGE_KEY } from './const'

export function readStoredBoolean(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : value === 'true'
  }
  catch {
    return fallback
  }
}

export function writeStoredBoolean(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value))
  }
  catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

export function readLastConversationId(): string | null {
  try {
    return localStorage.getItem(ASSISTANT_LAST_CONVERSATION_STORAGE_KEY)
  }
  catch {
    return null
  }
}

export function writeLastConversationId(id: string): void {
  try {
    localStorage.setItem(ASSISTANT_LAST_CONVERSATION_STORAGE_KEY, id)
  }
  catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

export function clearLastConversationId(expectedId?: string): void {
  try {
    if (expectedId && localStorage.getItem(ASSISTANT_LAST_CONVERSATION_STORAGE_KEY) !== expectedId)
      return
    localStorage.removeItem(ASSISTANT_LAST_CONVERSATION_STORAGE_KEY)
  }
  catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

export function chooseRestoredConversation(
  conversations: AiConversation[],
  activeConversationId: string | null,
  storedConversationId: string | null,
): AiConversation | null {
  return conversations.find(conversation => conversation.id === activeConversationId)
    ?? conversations.find(conversation => conversation.id === storedConversationId)
    ?? conversations[0]
    ?? null
}

interface ToolCanvasMeta {
  category: CanvasChangeCategory
  action: CanvasChangeAction
  iconCategory: string // 供 tool-icons 取图标
  label: string
  targetTab?: 'resume' | 'board' | 'version'
}

// 单一来源：工具 → 画布分类/动作/图标/标题（替代 tool-call-part 内旧 TOOL_META）
export const TOOL_CANVAS_META: Record<string, ToolCanvasMeta> = {
  list_resumes: { category: 'read', action: 'read', iconCategory: 'documents', label: '读取简历列表' },
  get_resume_detail: { category: 'read', action: 'read', iconCategory: 'documents', label: '读取简历内容' },
  update_current_resume_field: { category: 'resume', action: 'update', iconCategory: 'todos', label: '修改简历', targetTab: 'resume' },
  create_resume: { category: 'resume', action: 'create', iconCategory: 'documents', label: '新建简历', targetTab: 'resume' },
  update_resume_meta: { category: 'resume', action: 'update', iconCategory: 'todos', label: '修改简历信息', targetTab: 'resume' },
  delete_resume: { category: 'resume', action: 'delete', iconCategory: 'todos', label: '删除简历', targetTab: 'resume' },
  open_resume: { category: 'read', action: 'read', iconCategory: 'documents', label: '打开简历', targetTab: 'resume' },
  save_current_resume_version: { category: 'version', action: 'create', iconCategory: 'reminders', label: '保存历史版本', targetTab: 'version' },
  restore_current_resume_version: { category: 'version', action: 'restore', iconCategory: 'reminders', label: '恢复历史版本', targetTab: 'version' },
  delete_resume_version: { category: 'version', action: 'delete', iconCategory: 'reminders', label: '删除历史版本', targetTab: 'version' },
  list_resume_versions: { category: 'read', action: 'read', iconCategory: 'reminders', label: '读取历史版本', targetTab: 'version' },
  list_jobs: { category: 'read', action: 'read', iconCategory: 'goal_tracking', label: '读取求职看板', targetTab: 'board' },
  get_job: { category: 'read', action: 'read', iconCategory: 'goal_tracking', label: '读取职位详情', targetTab: 'board' },
  create_job: { category: 'board', action: 'create', iconCategory: 'goal_tracking', label: '新增职位', targetTab: 'board' },
  update_job: { category: 'board', action: 'update', iconCategory: 'goal_tracking', label: '修改职位', targetTab: 'board' },
  delete_job: { category: 'board', action: 'delete', iconCategory: 'goal_tracking', label: '删除职位', targetTab: 'board' },
  get_ats: { category: 'read', action: 'read', iconCategory: 'development', label: '读取 ATS 评分' },
  get_variant_tree: { category: 'read', action: 'read', iconCategory: 'memory', label: '读取派生血缘' },
  list_templates: { category: 'read', action: 'read', iconCategory: 'creative', label: '读取模板' },
  get_user_profile: { category: 'read', action: 'read', iconCategory: 'general', label: '读取用户资料' },
  get_current_time: { category: 'read', action: 'read', iconCategory: 'reminders', label: '获取当前时间' },
}

function summarizeChange(toolName: string, args: Record<string, unknown>, result: unknown): CanvasChange['detail'] {
  if (result && typeof result === 'object' && 'before' in result && 'after' in result) {
    const r = result as { before: unknown, after: unknown }
    return { kind: 'diff', before: r.before, after: r.after }
  }
  if (toolName === 'update_current_resume_field') {
    const sectionKey = String(args.sectionKey ?? '')
    return { kind: 'summary', text: `修改了简历模块「${sectionKey || '未知'}」` }
  }
  // 其它没有 before/after 的写操作（保存/恢复/删除历史版本等）：
  // 不再回退成原始 JSON，交由标题 + 状态徽标表达，保持变更记录统一整洁。
  return undefined
}

function buildTitle(meta: ToolCanvasMeta, args: Record<string, unknown>): string {
  if (meta.label === '新增职位' && args.data && typeof args.data === 'object') {
    const d = args.data as Record<string, unknown>
    if (d.company || d.position)
      return `新增职位 ${d.company ?? ''} · ${d.position ?? ''}`.trim()
  }
  if (meta.label === '新建简历' && args.display_name)
    return `新建简历「${String(args.display_name)}」`
  return meta.label
}

export function deriveCanvasModel(messages: AiMessage[], streamingParts: AiMessagePart[] = []): CanvasModel {
  const allParts: AiMessagePart[] = [
    ...messages.flatMap(m => m.parts),
    ...streamingParts,
  ]
  const changes: CanvasChange[] = []

  for (const part of allParts) {
    if (part.type !== 'tool-call')
      continue
    const meta = TOOL_CANVAS_META[part.toolName] ?? {
      category: 'read' as const,
      action: 'read' as const,
      iconCategory: 'general',
      label: part.toolName,
    }
    const args = (part.args ?? {}) as Record<string, unknown>
    const detail = meta.category === 'read' ? undefined : summarizeChange(part.toolName, args, part.result)
    const stat = detail?.kind === 'diff' ? diffStat(computeLineDiff(detail.before, detail.after)) : undefined
    // 「修改当前简历字段」成功后可撤销：把该模块写回 before
    let undo: CanvasChange['undo']
    if (part.toolName === 'update_current_resume_field' && part.state === 'result'
      && part.result && typeof part.result === 'object') {
      const r = part.result as Record<string, unknown>
      if (typeof r.sectionKey === 'string' && 'before' in r)
        undo = { sectionKey: r.sectionKey, before: r.before }
    }
    changes.push({
      id: part.toolCallId,
      toolName: part.toolName,
      category: meta.category,
      action: meta.action,
      title: buildTitle(meta, args),
      detail,
      stat: stat && (stat.additions > 0 || stat.deletions > 0) ? stat : undefined,
      state: part.state,
      targetTab: meta.targetTab,
      undo,
    })
  }

  const writes = changes.filter(c => c.category !== 'read')
  return {
    changes,
    writes,
    touchedBoard: changes.some(c => c.targetTab === 'board'),
    touchedVersion: changes.some(c => c.targetTab === 'version'),
    hasWrites: writes.length > 0,
  }
}
