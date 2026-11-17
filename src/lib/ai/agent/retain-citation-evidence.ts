import type { AiMessage, AiMessagePart } from '../types'
import type { ExperienceSourceReference } from '@/lib/experience-sources/types'
import { collectCitationEvidence } from './citation-evidence'
import type { CitationEvidence } from './citation-evidence'

export function createCitationEvidenceRetainer(
  history: AiMessage[],
  sources: ExperienceSourceReference[],
) {
  const allowed = new Set(
    sources.map((source) => `${source.sourceId}:${source.versionId}`),
  )

  const evidence = collectCitationEvidence(
    history
      .filter((message) => message.role === 'assistant')
      .flatMap((message) => message.parts),
  )

  const known = new Map(
    evidence
      .filter((item) => allowed.has(`${item.sourceId}:${item.versionId}`))
      .map((item) => [
        `${item.sourceId}:${item.versionId}:${item.block.id}`,
        item,
      ]),
  )

  return (parts: AiMessagePart[]): AiMessagePart[] => {
    const result: AiMessagePart[] = parts.filter(
      (part) => part.type !== 'citation-evidence',
    )

    const cited = new Map<string, CitationEvidence>()

    for (const part of result) {
      if (part.type !== 'text') continue

      for (const match of part.text.matchAll(/https?:\/\/[^\s<>)]+/g)) {
        let url: URL

        try {
          url = new URL(match[0])
        } catch {
          continue
        }

        if (
          url.origin !== window.location.origin ||
          url.pathname !== '/experience'
        )
          continue

        const key = ['sourceId', 'versionId', 'blockId']
          .map((name) => url.searchParams.get(name))
          .join(':')

        const source = known.get(key)

        if (source) cited.set(key, source)
      }
    }

    // 只随回复保留实际引用的旧证据，分页回看不依赖整段工具历史。
    if (cited.size)
      result.push({ type: 'citation-evidence', sources: [...cited.values()] })

    return result
  }
}
