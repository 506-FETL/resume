import type { ExperienceSourceRelation } from '@/lib/experience-sources/types'
import { getExperienceSourceMetadata } from '@/lib/experience-sources/api'

// 压缩与发送共用资料版本和更新时间，避免下一次请求把刚保存的摘要判为过期。
export async function loadRunSources(
  frozenSources: ExperienceSourceRelation[],
  conversationId: string,
  signal: AbortSignal,
) {
  const statuses = await Promise.all(
    Array.from({ length: Math.ceil(frozenSources.length / 100) }, (_, index) =>
      getExperienceSourceMetadata(
        frozenSources
          .slice(index * 100, (index + 1) * 100)
          .map((source) => source.sourceId),
        signal,
      ),
    ),
  )

  const available = new Map(
    statuses
      .flatMap((result) => result.items)
      .map((source) => [source.id, source]),
  )

  const sources = frozenSources.flatMap((source) => {
    const metadata = available.get(source.sourceId)

    return metadata?.status === 'ready' &&
      (!metadata.conversationId || metadata.conversationId === conversationId)
      ? [
          {
            ...source,
            currentVersionId: metadata.currentVersionId,
            updatedAt: metadata.updatedAt,
          },
        ]
      : []
  })

  return { available, sources }
}
