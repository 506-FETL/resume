import type { CanvasModel } from '../types'
import { useMemo } from 'react'
import useAssistantStore from '../store'
import { deriveCanvasModel } from '../utils'

export function useCanvasModel(): CanvasModel {
  const messages = useAssistantStore(s => s.messages)
  const streamingParts = useAssistantStore(s => s.streamingParts)
  // 按「当前画布正在预览的简历」隔离变更记录 / 标签：预览简历切换时模型同步收敛。
  const previewResumeId = useAssistantStore(s => s.previewResumeId)
  return useMemo(
    () => deriveCanvasModel(messages, streamingParts, previewResumeId),
    [messages, streamingParts, previewResumeId],
  )
}
