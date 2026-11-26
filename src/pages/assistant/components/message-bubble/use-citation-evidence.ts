import { useMemo } from 'react'
import type { AiMessage } from '@/lib/ai/types'
import {
  collectCitationEvidence,
  collectPreviousCitationEvidence,
  type CitationEvidence,
} from '@/lib/ai/agent/citation-evidence'
import useUserStore from '@/store/user'
import useAssistantStore from '../../store'

export function useCitationEvidence({
  id,
  conversationId,
  role,
  parts,
}: AiMessage) {
  const history = useAssistantStore((state) =>
    role === 'assistant' ? state.messages : null,
  )

  const ownerId = useUserStore((state) => state.currentUser?.id ?? '')

  const readHistory = useMemo(() => {
    let evidence: CitationEvidence[] | undefined

    return () =>
      (evidence ??= history
        ? collectPreviousCitationEvidence(id, conversationId, history, ownerId)
        : [])
  }, [id, conversationId, history, ownerId])

  // Markdown 渲染出实际出处时才核对证据，普通文本与思考增量不用扫描旧工具结果。
  return useMemo(() => {
    let evidence: CitationEvidence[] | undefined

    return () =>
      (evidence ??= [...readHistory(), ...collectCitationEvidence(parts)])
  }, [readHistory, parts])
}
