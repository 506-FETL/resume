import type { TemplateAssetRef } from './types'
import { z } from 'zod'
import { TemplateResolutionError } from '../definition-schema'

export const assetEnvelopeSchema = z
  .object({
    content_hash: z.string().regex(/^[a-f0-9]{64}$/),
    mime_type: z.enum(['image/png', 'image/webp', 'image/jpeg']),
    byte_size: z.number().int().positive().max(524288),
    width: z.number().int().positive().max(4096),
    height: z.number().int().positive().max(4096),
    content_base64: z
      .string()
      .min(4)
      .max(699052)
      .regex(/^(?:[A-Z\d+/]{4})*(?:[A-Z\d+/]{2}==|[A-Z\d+/]{3}=)?$/i),
  })
  .strict()

export async function decodeAsset(
  input: unknown,
  ref: TemplateAssetRef,
): Promise<Blob> {
  const asset = assetEnvelopeSchema.parse(input)
  if (
    asset.content_hash !== ref.hash ||
    asset.mime_type !== ref.mimeType ||
    asset.byte_size !== ref.byteLength ||
    asset.width !== ref.width ||
    asset.height !== ref.height
  )
    throw new TemplateResolutionError(
      'REFERENCE_MISMATCH',
      '模板素材与请求的精确引用不一致',
    )
  const bytes = Uint8Array.from(atob(asset.content_base64), (character) =>
    character.charCodeAt(0),
  )
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  if (bytes.byteLength !== ref.byteLength || hash !== ref.hash)
    throw new TemplateResolutionError(
      'INVALID_DEFINITION',
      '模板素材完整性校验失败，请重试',
    )
  const blob = new Blob([bytes], { type: ref.mimeType })
  // 哈希固定字节；实际像素尺寸同样核验，拒绝伪造的发布元数据。
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob)
    const matches = bitmap.width === ref.width && bitmap.height === ref.height
    bitmap.close()
    if (!matches)
      throw new TemplateResolutionError(
        'INVALID_DEFINITION',
        '模板素材实际尺寸与清单不一致',
      )
  }
  return blob
}
