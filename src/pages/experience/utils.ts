import { getCachedSourcePage } from '@/store/experience-sources/page-cache'
import type { ExperienceStore } from '@/store/experience-sources/types'
import type { ExperienceFilter } from './types'

export { formatSourceDate } from '@/features/experience-sources/utils'

export function getExperienceListSource(
  data: Pick<ExperienceStore, 'pages' | 'stalePages' | 'metadata'>,
  page: { query: string; offset: number; filter: ExperienceFilter },
  sourceId: string | null,
) {
  if (!sourceId) return

  const { query, offset, filter } = page
  const kind = filter === 'all' ? undefined : filter
  const fresh = getCachedSourcePage(data, query, offset, kind)

  if (fresh) return fresh.items.find((source) => source.id === sourceId)

  const metadata = data.metadata[sourceId]

  if (metadata?.status !== 'ready') return

  // 搜索结果可以已过期，只有本条的版本和更新时间仍获确认时才采用缓存行。
  const cached = data.pages[JSON.stringify([query, offset, kind])]?.items.find(
    (source) => source.id === sourceId,
  )

  if (
    cached &&
    cached.currentVersionId === metadata.source.currentVersionId &&
    cached.updatedAt === metadata.source.updatedAt
  )
    return cached
}
