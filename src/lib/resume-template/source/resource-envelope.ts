import { z } from 'zod'
import { TemplateResolutionError } from '../errors'

export const resourceEnvelopeSchema = z
  .object({
    content: z.string().max(524288),
    content_hash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()

export async function decodeResource(input: unknown): Promise<unknown> {
  const { content, content_hash: expected } =
    resourceEnvelopeSchema.parse(input)

  const bytes = new TextEncoder().encode(content)

  if (bytes.byteLength > 524288)
    throw new TemplateResolutionError('RESOURCE_LIMIT', '模板资源超过字节预算')

  const digest = await crypto.subtle.digest('SHA-256', bytes)

  const actual = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')

  if (actual !== expected)
    throw new TemplateResolutionError(
      'INVALID_DEFINITION',
      '模板资源完整性校验失败，请重试',
    )

  return JSON.parse(content)
}
