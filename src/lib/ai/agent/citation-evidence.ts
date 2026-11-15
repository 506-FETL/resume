import { z } from 'zod'
import type { AiMessagePart } from '../types'

const blockSchema = z.object({
  id: z.string().min(1).max(120),
  text: z.string(),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  page: z.number().int().positive().optional(),
})

const sourceSchema = z.object({
  sourceId: z.string().uuid(),
  versionId: z.string().uuid(),
  name: z.string(),
})

export type CitationEvidence = z.infer<typeof sourceSchema> & {
  block: z.infer<typeof blockSchema>
}

export function collectCitationEvidence(
  parts: AiMessagePart[],
): CitationEvidence[] {
  const evidence: CitationEvidence[] = []

  for (const part of parts) {
    if (part.type !== 'tool-call' || part.state !== 'result') continue

    if (part.toolName === 'read_experience_source') {
      const parsed = sourceSchema
        .extend({ blocks: z.array(blockSchema) })
        .safeParse(part.result)

      if (parsed.success)
        evidence.push(
          ...parsed.data.blocks.map((block) => ({ ...parsed.data, block })),
        )
    } else if (part.toolName === 'search_experience_sources') {
      const parsed = z
        .object({
          matches: z.array(
            sourceSchema.extend({
              block: blockSchema,
              context: z.array(blockSchema),
            }),
          ),
        })
        .safeParse(part.result)

      if (parsed.success)
        for (const match of parsed.data.matches)
          evidence.push(
            ...[match.block, ...match.context].map((block) => ({
              sourceId: match.sourceId,
              versionId: match.versionId,
              name: match.name,
              block,
            })),
          )
    }
  }

  return evidence
}

export function citationLabel(evidence: CitationEvidence): string {
  const { name, block } = evidence

  const ordinal = /^b(\d{4,})$/.exec(block.id)?.[1]
  const position = ordinal ? `第 ${Number(ordinal)} 段` : `段落 ${block.id}`

  return `${name} · ${block.page ? `第 ${block.page} 页 · ` : ''}${position}`
}

export function resolveCitationEvidence(
  evidence: CitationEvidence[],
  reference: {
    sourceId: string
    versionId: string
    blockId: string
    quote?: string
  },
  linkText: string,
): CitationEvidence | undefined {
  const source = evidence.find(
    (item) =>
      item.sourceId === reference.sourceId &&
      item.versionId === reference.versionId &&
      item.block.id === reference.blockId,
  )

  if (!source) return

  const quotes = [
    ...(reference.quote ? [reference.quote] : []),
    ...[...linkText.matchAll(/[“「『"]([^”」』"]+)[”」』"]/g)].map(
      (match) => match[1],
    ),
  ]

  if (quotes.some((quote) => !source.block.text.includes(quote))) return

  return source
}
