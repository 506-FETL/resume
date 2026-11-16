import type { connectDocumentSession } from '../service'
import type { SessionRuntime } from './types'

export async function loadRichTextCollabStore() {
  try {
    return (await import('../../richtext/store')).default
  } catch (error) {
    throw new Error('协作编辑组件加载失败，请重试', { cause: error })
  }
}

export const startRichTextSession = (
  runtime: SessionRuntime,
  result: Awaited<ReturnType<typeof connectDocumentSession>>,
  seed: boolean,
) => {
  runtime.richTextStore!.getState().start({
    resumeId: result.resumeId,
    sessionId: result.sessionId,
    role: result.role,
    userName: result.self.userName,
    color: result.self.color,
    userId: result.self.userId,
    seed,
  })
}
