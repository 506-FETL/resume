import type { CanvasModel } from '../types'
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import useAssistantStore from '../store'
import { buildCanvasModel, deriveCanvasChanges } from '../utils/canvas-model'

export function useCanvasModel(): CanvasModel {
  const messages = useAssistantStore((s) => s.messages)

  const streamingTools = useAssistantStore(
    useShallow((s) =>
      s.streamingParts.filter((part) => part.type === 'tool-call'),
    ),
  )

  // 按「当前画布正在预览的简历」隔离变更记录 / 标签：预览简历切换时模型同步收敛。
  const previewResumeId = useAssistantStore((s) => s.previewResumeId)

  const history = useMemo(
    () => deriveCanvasChanges(messages.flatMap((message) => message.parts)),
    [messages],
  )

  const changes = useMemo(
    () =>
      streamingTools.length
        ? [...history, ...deriveCanvasChanges(streamingTools)]
        : history,
    [history, streamingTools],
  )

  return useMemo(
    () => buildCanvasModel(changes, previewResumeId),
    [changes, previewResumeId],
  )
}
