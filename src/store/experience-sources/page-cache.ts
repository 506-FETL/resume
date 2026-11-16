import type { ExperienceStore, SourcePage } from './types'
import type { ExperienceSource } from '@/lib/experience-sources/types'

export function getCachedSourcePage(
  state: Pick<ExperienceStore, 'pages' | 'stalePages'>,
  query: string,
  offset: number,
  kind?: 'files' | 'paste',
): SourcePage | undefined {
  const key = JSON.stringify([query, offset, kind])

  if (state.pages[key] && !state.stalePages[key]) return state.pages[key]
  if (!kind) return

  const firstKey = JSON.stringify([query, 0, undefined])
  const first = state.pages[firstKey]

  if (!first || state.stalePages[firstKey]) return

  const all: ExperienceSource[] = []

  for (let start = 0; start < first.total; start += 10) {
    const pageKey = JSON.stringify([query, start, undefined])
    const page = state.pages[pageKey]

    if (
      !page ||
      state.stalePages[pageKey] ||
      page.total !== first.total ||
      page.items.length !== Math.min(10, first.total - start)
    )
      return

    all.push(...page.items)
  }

  if (new Set(all.map((source) => source.id)).size !== first.total) return

  const filtered = all.filter((source) =>
    kind === 'paste' ? source.kind === 'paste' : source.kind !== 'paste',
  )

  return {
    items: filtered.slice(offset, offset + 10),
    total: filtered.length,
    hasMore: offset + 10 < filtered.length,
  }
}
