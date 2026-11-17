import { useMemo } from 'react'
import type { AiMessage } from '@/lib/ai/types'
import { collectMessageCitationEvidence } from '@/lib/ai/agent/citation-evidence'
import useUserStore from '@/store/user'
import useAssistantStore from '../../store'

export function useCitationEvidence(message: AiMessage) {
  const history = useAssistantStore((state) => state.messages)
  const ownerId = useUserStore((state) => state.currentUser?.id ?? '')

  return useMemo(
    () => collectMessageCitationEvidence(message, history, ownerId),
    [message, history, ownerId],
  )
}
