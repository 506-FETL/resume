import type { ExperienceStore, SourcePage } from './types'
import type { ExperienceSource } from '@/lib/experience-sources/types'

export function renameSourcePages(
  state: ExperienceStore,
  source: ExperienceSource,
) {
  const pages = { ...state.pages }
  const stalePages = { ...state.stalePages }

  for (const [key, page] of Object.entries(pages)) {
    const [query, offset, kind] = JSON.parse(key) as [
      string,
      number,
      string | null,
    ]

    const firstKey = JSON.stringify([query, 0, kind])
    const first = state.pages[firstKey]
    const previous = first?.items.find((item) => item.id === source.id)

    const canPromote =
      !query &&
      previous?.kind === source.kind &&
      !state.stalePages[firstKey] &&
      first.items.every(
        (item) =>
          item.id === source.id ||
          Date.parse(source.updatedAt) > Date.parse(item.updatedAt),
      )

    if (canPromote && offset === 0) {
      pages[key] = {
        ...page,
        items: [source, ...page.items.filter((item) => item.id !== source.id)],
      }

      continue
    }

    if (!canPromote) stalePages[key] = true
    if (page.items.some((item) => item.id === source.id))
      pages[key] = {
        ...page,
        items: page.items.map((item) =>
          item.id === source.id ? source : item,
        ),
      }
  }

  return { pages, stalePages }
}

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
