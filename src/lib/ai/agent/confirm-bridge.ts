// 写工具确认桥：写工具调用 requestConfirm 挂起，UI 层通过 store 的 pendingConfirm 处理，
// 用户确认/取消后 resolve。store 层在初始化时注入 handler，解耦 lib 与 React。

export interface ConfirmPreview {
  kind:
    | 'resume-field'
    | 'resume-create'
    | 'resume-delete'
    | 'job-update'
    | 'job-create'
    | 'job-delete'
    | 'version-save'
    | 'version-restore'
    | 'version-delete'
  title: string
  // resume-field
  sectionKey?: string
  before?: unknown
  after?: unknown
  // 其余操作用一句话摘要描述影响
  summary?: string
}

export interface ConfirmRequest {
  id: string
  toolName: string
  preview: ConfirmPreview
  // 确认时真正执行写入；返回结果对象
  apply: () => Promise<unknown>
}

export type ConfirmDecision =
  | { kind: 'accept' }
  | { kind: 'reject' }
  | { kind: 'revise'; feedback: string; proposalId: string }

// UI 层（store）注入的处理器：弹卡 → 等用户 → 返回是否确认。
// 真正 apply 由本桥在确认后执行，确保取消信号可在写入前统一守卫。
type ConfirmHandler = (
  req: ConfirmRequest,
  signal?: AbortSignal,
) => Promise<ConfirmDecision>

export type ConfirmApplyState = 'applying' | 'result' | 'error' | 'cancelled'

type ConfirmApplyHandler = (
  id: string,
  state: ConfirmApplyState,
  result?: unknown,
) => void

let handler: ConfirmHandler | null = null
let applyHandler: ConfirmApplyHandler | null = null

export function setConfirmHandler(
  h: ConfirmHandler | null,
  onApply: ConfirmApplyHandler | null = null,
): void {
  handler = h
  applyHandler = onApply
}

// 未安装 UI 确认处理器时，不允许工具自行写入。
export async function requestConfirm(
  req: ConfirmRequest,
  signal?: AbortSignal,
): Promise<unknown> {
  if (signal?.aborted) return { cancelled: true }

  if (!handler)
    return { cancelled: true, message: '当前无法确认修改，请重新打开助手。' }

  const decision = await handler(req, signal)

  if (decision.kind === 'revise')
    return {
      cancelled: true,
      revisionRequested: true,
      proposalId: decision.proposalId,
      feedback: decision.feedback,
    }
  if (decision.kind !== 'accept') return { cancelled: true }
  if (signal?.aborted) {
    applyHandler?.(req.id, 'cancelled')

    return { cancelled: true }
  }

  const notify = applyHandler

  notify?.(req.id, 'applying')

  try {
    const result = await req.apply()

    const failed = Boolean(
      result && typeof result === 'object' && 'error' in result,
    )

    notify?.(req.id, failed ? 'error' : 'result', result)

    return result
  } catch (error) {
    notify?.(req.id, 'error', {
      error: error instanceof Error ? error.message : '应用修改失败',
    })

    throw error
  }
}
