import { z } from 'zod'
import type { AiMessage, AiMessagePart } from '../types'

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

export const citationEvidencePartSchema = z.object({
  type: z.literal('citation-evidence'),
  sources: z.array(sourceSchema.extend({ block: blockSchema })),
})

export function collectCitationEvidence(
  parts: AiMessagePart[],
): CitationEvidence[] {
  const evidence: CitationEvidence[] = []

  for (const part of parts) {
    if (part.type === 'citation-evidence') {
      const parsed = citationEvidencePartSchema.safeParse(part)

      if (parsed.success) evidence.push(...parsed.data.sources)

      continue
    }
    if (part.type !== 'tool-call' || part.state !== 'result') continue

    if (part.toolName === 'read_experience_source') {
      const parsed = sourceSchema
        .extend({ blocks: z.array(blockSchema) })
        .safeParse(part.result)

      if (parsed.success)
        evidence.push(
          ...parsed.data.blocks.map((block) => ({
            sourceId: parsed.data.sourceId,
            versionId: parsed.data.versionId,
            name: parsed.data.name,
            block,
          })),
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

  const ordinal = /^(?:f1-)?b(\d{4,})$/.exec(block.id)?.[1]
  const position = ordinal ? `第 ${Number(ordinal)} 段` : `段落 ${block.id}`

  return `${name} · ${block.page ? `第 ${block.page} 页 · ` : ''}${position}`
}

export function collectPreviousCitationEvidence(
  messageId: string,
  conversationId: string,
  history: AiMessage[],
  ownerId: string,
): CitationEvidence[] {
  const index = history.findIndex((item) => item.id === messageId)

  const previous =
    messageId === 'streaming' ? history : history.slice(0, Math.max(0, index))

  const conversation = previous.filter(
    (item) => item.userId === ownerId && item.conversationId === conversationId,
  )

  const scope = [...conversation]
    .reverse()
    .find((item) => item.role === 'user')
    ?.parts.find((part) => part.type === 'source-scope')?.sources

  if (!scope?.length) return []

  const allowed = new Set(
    scope.map((source) => `${source.sourceId}:${source.versionId}`),
  )

  const parts = conversation
    .filter((item) => item.role === 'assistant')
    .flatMap((item) => item.parts)

  return collectCitationEvidence(parts).filter((item) =>
    allowed.has(`${item.sourceId}:${item.versionId}`),
  )
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
