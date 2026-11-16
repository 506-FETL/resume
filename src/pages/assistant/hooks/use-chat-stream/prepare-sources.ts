import type { SendLifecycle } from './types'
import { loadRunSources } from './load-run-sources'
import type { AiUserReference } from '@/lib/ai/types'
import type { ExperienceSourceRelation } from '@/lib/experience-sources/types'
import {
  getExperienceRelations,
  setExperienceRelations,
} from '@/lib/experience-sources/api'
import useAssistantStore from '../../store'

export async function prepareRunSources(
  frozenSources: ExperienceSourceRelation[],
  references: AiUserReference[],
  conversationId: string,
  controller: AbortController,
  ownsCurrentRun: SendLifecycle['ownsCurrentRun'],
) {
  const { available, sources: runSources } = await loadRunSources(
    frozenSources,
    conversationId,
    controller.signal,
  )

  const selectedSources = references
    .filter(
      (reference) =>
        reference.type === 'reference' && reference.kind === 'experience',
    )
    .map((reference) => ({
      sourceId: reference.id,
      versionId: reference.versionId,
      name: reference.label,
    }))

  if (
    selectedSources.some((source) => {
      const metadata = available.get(source.sourceId)

      return (
        metadata?.conversationId && metadata.conversationId !== conversationId
      )
    })
  )
    throw new Error('附件属于其他对话，请移除后在当前对话重新上传。')

  if (selectedSources.length) {
    const existing = await getExperienceRelations({
      target: 'conversation',
      targetId: conversationId,
      signal: controller.signal,
    })

    const nextSources = [
      ...new Map(
        [...existing, ...selectedSources].map((source) => [
          source.sourceId,
          source,
        ]),
      ).values(),
    ]

    await setExperienceRelations({
      target: 'conversation',
      targetId: conversationId,
      references: nextSources,
      signal: controller.signal,
    })

    if (ownsCurrentRun(conversationId))
      useAssistantStore.setState((state) => ({
        sourceScopeRevision: state.sourceScopeRevision + 1,
      }))
  }

  return runSources
}
