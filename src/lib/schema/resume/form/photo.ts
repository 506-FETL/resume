import { z } from 'zod'

export const RESUME_PHOTO_MAX_BYTES = 96 * 1024
export const RESUME_PHOTO_MAX_EDGE = 640
const prefix = 'data:image/jpeg;base64,'

/** 校验快照中的编码、实际 JPEG 尺寸与声明一致；图片解码另由资源就绪门禁验证。 */
export function inspectResumePhoto(
  dataUrl: string,
): { width: number; height: number } | null {
  if (
    !dataUrl.startsWith(prefix) ||
    dataUrl.length > prefix.length + Math.ceil(RESUME_PHOTO_MAX_BYTES / 3) * 4
  )
    return null
  const encoded = dataUrl.slice(prefix.length)
  if (
    !encoded ||
    encoded.length % 4 !== 0 ||
    !/^[A-Z\d+/]+={0,2}$/i.test(encoded)
  )
    return null
  let bytes: string
  try {
    bytes = atob(encoded)
  } catch {
    return null
  }
  if (bytes.length > RESUME_PHOTO_MAX_BYTES || bytes.length < 16) return null
  const byte = (index: number) => bytes.charCodeAt(index)
  const word = (index: number) => byte(index) * 256 + byte(index + 1)
  if (word(0) !== 0xffd8 || word(bytes.length - 2) !== 0xffd9) return null
  let offset = 2
  let dimensions: { width: number; height: number } | null = null
  while (offset + 4 <= bytes.length) {
    if (byte(offset++) !== 0xff) return null
    while (byte(offset) === 0xff) offset++
    const marker = byte(offset++)
    if (marker === 0xda) return dimensions
    if (marker === 0xd9) return null
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    const length = word(offset)
    if (length < 2 || offset + length > bytes.length) return null
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (length < 8) return null
      dimensions = { width: word(offset + 5), height: word(offset + 3) }
      if (
        !dimensions.width ||
        !dimensions.height ||
        Math.max(dimensions.width, dimensions.height) > RESUME_PHOTO_MAX_EDGE
      )
        return null
    }
    offset += length
  }
  return null
}

export const resumePhotoSchema = z
  .object({
    dataUrl: z
      .string()
      .max(prefix.length + Math.ceil(RESUME_PHOTO_MAX_BYTES / 3) * 4),
    width: z.number().int().positive().max(RESUME_PHOTO_MAX_EDGE),
    height: z.number().int().positive().max(RESUME_PHOTO_MAX_EDGE),
  })
  .strict()
  .superRefine((photo, context) => {
    const dimensions = inspectResumePhoto(photo.dataUrl)
    if (
      !dimensions ||
      dimensions.width !== photo.width ||
      dimensions.height !== photo.height
    )
      context.addIssue({
        code: 'custom',
        message: '照片必须是有效的 JPEG 小图，尺寸和大小须符合要求',
      })
  })
export type ResumePhoto = z.infer<typeof resumePhotoSchema>
