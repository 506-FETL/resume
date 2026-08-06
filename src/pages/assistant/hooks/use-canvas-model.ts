import type { CanvasModel } from '../types'
import { useMemo } from 'react'
import useAssistantStore from '../store'
import { deriveCanvasModel } from '../utils'

export function useCanvasModel(): CanvasModel {
  const { messages, streamingParts } = useAssistantStore()
  return useMemo(() => deriveCanvasModel(messages, streamingParts), [messages, streamingParts])
}
