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

// UI 层（store）注入的处理器：弹卡 → 等用户 → 返回是否确认。
// 真正 apply 由本桥在确认后执行，确保取消信号可在写入前统一守卫。
type ConfirmHandler = (req: ConfirmRequest, signal?: AbortSignal) => Promise<{ confirmed: boolean }>

let handler: ConfirmHandler | null = null

export function setConfirmHandler(h: ConfirmHandler | null): void {
  handler = h
}

// 写工具调用此函数：无 handler（理论不会）仍遵守取消信号。
export async function requestConfirm(req: ConfirmRequest, signal?: AbortSignal): Promise<unknown> {
  if (signal?.aborted)
    return { cancelled: true }

  if (!handler)
    return signal?.aborted ? { cancelled: true } : req.apply()

  const { confirmed } = await handler(req, signal)
  if (!confirmed)
    return { cancelled: true }
  if (signal?.aborted)
    return { cancelled: true }
  return req.apply()
}
