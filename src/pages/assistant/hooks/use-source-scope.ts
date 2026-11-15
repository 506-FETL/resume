import { useEffect, useState } from 'react'
import { resolveActiveResumeId } from '@/lib/ai/active-resume'
import { useExperienceSourcesStore } from '@/store/experience-sources'
import useUserStore from '@/store/user'
import useAssistantStore from '../store'
import {
  loadSourceScope,
  peekSourceScope,
  peekSourceScopeDetails,
  sourceScopeKey,
} from '../store/source-scope'
import type { ExperienceSourceRelation } from '@/lib/experience-sources/types'

export function useSourceScope() {
  const ownerId = useUserStore((state) => state.currentUser?.id)

  const conversationId = useAssistantStore(
    (state) => state.activeConversationId,
  )

  const scopeRevision = useAssistantStore((state) => state.sourceScopeRevision)

  useAssistantStore((state) => state.previewResumeId)
  useAssistantStore((state) => state.explicitPreviewResumeId)
  useAssistantStore((state) => state.conversations)
  useExperienceSourcesStore((state) => state.revision)

  const resumeId = resolveActiveResumeId()

  const target = {
    ownerId: ownerId ?? '',
    conversationId,
    resumeId,
    scopeRevision,
  }

  const key = sourceScopeKey(target)
  const [attempt, setAttempt] = useState(0)

  const [view, setView] = useState<{
    key: string
    sources?: ExperienceSourceRelation[]
    error?: string
  }>({ key: '' })

  const cached = peekSourceScope(target)
  const sources = cached ?? (view.key === key ? view.sources : undefined)
  const error = view.key === key ? view.error : undefined

  useEffect(() => {
    if (!ownerId) return

    let active = true

    loadSourceScope({ ownerId, conversationId, resumeId, scopeRevision }).then(
      (sources) => {
        if (active) setView({ key, sources })
      },
      (cause: unknown) => {
        if (active)
          setView({
            key,
            error: cause instanceof Error ? cause.message : '资料范围读取失败',
          })
      },
    )

    return () => {
      active = false
    }
  }, [ownerId, conversationId, resumeId, scopeRevision, key, attempt])

  return {
    sources,
    ...peekSourceScopeDetails(target),
    error,
    retry: () => setAttempt((value) => value + 1),
  }
}
