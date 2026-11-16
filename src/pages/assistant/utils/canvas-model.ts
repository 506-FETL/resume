import type { ToolCanvasMeta } from './tool-canvas-meta'
import type { CanvasChange, CanvasModel } from '../types'
import type { AiMessage, AiMessagePart } from '@/lib/ai/types'
import { getSkillToolLabel } from '@/lib/ai/skills/presentation'
import { fieldDiffStat } from '../components/diff/compute-field-diff'
import { TOOL_CANVAS_META } from './tool-canvas-meta'

function summarizeChange(
  toolName: string,
  args: Record<string, unknown>,
  result: unknown,
): CanvasChange['detail'] {
  if (
    result &&
    typeof result === 'object' &&
    'before' in result &&
    'after' in result
  ) {
    const r = result as { before: unknown; after: unknown }

    return { kind: 'diff', before: r.before, after: r.after }
  }
  if (toolName === 'update_current_resume_field') {
    const sectionKey = String(args.sectionKey ?? '')

    return {
      kind: 'summary',
      text: `修改了简历模块「${sectionKey || '未知'}」`,
    }
  }

  // 其它没有 before/after 的写操作（保存/恢复/删除历史版本等）：
  // 不再回退成原始 JSON，交由标题 + 状态徽标表达，保持变更记录统一整洁。
  return undefined
}

function buildTitle(
  meta: ToolCanvasMeta,
  args: Record<string, unknown>,
): string {
  if (meta.label === '新增职位' && args.data && typeof args.data === 'object') {
    const d = args.data as Record<string, unknown>

    if (d.company || d.position)
      return `新增职位 ${d.company ?? ''} · ${d.position ?? ''}`.trim()
  }
  if (meta.label === '新建简历' && args.display_name)
    return `新建简历「${String(args.display_name)}」`

  return meta.label
}

// 解析一条工具调用所属的简历 id：优先取执行结果里的 resumeId（执行期真实目标，
// 最可靠），回退取入参 resumeId（如 update_resume_meta / delete_resume）。
// 看板 / 读操作 / 无 resumeId 的历史遗留结果返回 undefined，由过滤规则兜底保留。
function resolveChangeResumeId(
  args: Record<string, unknown>,
  result: unknown,
): string | undefined {
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>

    if (typeof r.resumeId === 'string' && r.resumeId) return r.resumeId
  }
  if (typeof args.resumeId === 'string' && args.resumeId) return args.resumeId

  return undefined
}

export function deriveCanvasModel(
  messages: AiMessage[],
  streamingParts: AiMessagePart[] = [],
  scopeResumeId: string | null = null,
): CanvasModel {
  const allParts: AiMessagePart[] = [
    ...messages.flatMap((m) => m.parts),
    ...streamingParts,
  ]

  const changes: CanvasChange[] = []

  for (const part of allParts) {
    if (part.type !== 'tool-call') continue

    const meta = TOOL_CANVAS_META[part.toolName] ?? {
      category: 'read' as const,
      action: 'read' as const,
      iconCategory: 'general',
      label: part.toolName,
    }

    const args = (part.args ?? {}) as Record<string, unknown>

    const detail =
      meta.category === 'read'
        ? undefined
        : summarizeChange(part.toolName, args, part.result)

    // 徽标增删统计与对话流工具行统一走字段级口径（避免同一改动两处数字不一致）
    const sectionKey =
      typeof args.sectionKey === 'string' ? args.sectionKey : undefined

    const stat =
      detail?.kind === 'diff' && sectionKey
        ? (fieldDiffStat(sectionKey, detail.before, detail.after) ?? undefined)
        : undefined

    // 「修改当前简历字段」成功后可撤销：把该模块写回 before
    let undo: CanvasChange['undo']

    const targetResumeId =
      resolveChangeResumeId(args, part.result) ??
      part.targetResumeId ??
      undefined

    if (
      part.toolName === 'update_current_resume_field' &&
      part.state === 'result' &&
      part.result &&
      typeof part.result === 'object'
    ) {
      const r = part.result as Record<string, unknown>

      if (targetResumeId && typeof r.sectionKey === 'string' && 'before' in r)
        undo = { sectionKey: r.sectionKey, before: r.before }
    }

    changes.push({
      id: part.toolCallId,
      toolName: part.toolName,
      category: meta.category,
      action: meta.action,
      title: getSkillToolLabel(part.toolName, args) ?? buildTitle(meta, args),
      detail,
      stat:
        stat && (stat.additions > 0 || stat.deletions > 0) ? stat : undefined,
      state: part.state,
      targetTab: meta.targetTab,
      resumeId: targetResumeId,
      undo,
      undone: part.undone,
    })
  }

  // 按「当前画布正在预览的简历」隔离：看板（全局进度）与读操作恒保留；
  // 简历 / 历史版本类仅保留属于该简历的改动。scopeResumeId 或 change.resumeId
  // 缺失时保留，避免未解析出目标时误伤（含历史遗留结果）。
  const scopedChanges = scopeResumeId
    ? changes.filter((c) => {
        if (c.category === 'board' || c.category === 'read') return true

        return !c.resumeId || c.resumeId === scopeResumeId
      })
    : changes

  const writes = scopedChanges.filter((c) => c.category !== 'read')

  return {
    changes: scopedChanges,
    writes,
    touchedBoard: scopedChanges.some((c) => c.targetTab === 'board'),
    touchedVersion: scopedChanges.some((c) => c.targetTab === 'version'),
    hasWrites: writes.length > 0,
  }
}
