import type { PercentCrop } from 'react-image-crop'
import type { ResumePhoto } from '@/lib/schema/resume/form/photo'
import { RESUME_PHOTO_MAX_BYTES, RESUME_PHOTO_MAX_EDGE, resumePhotoSchema } from '@/lib/schema/resume/form/photo'

export async function readPhotoFile(file: File): Promise<string> {
  if (file.size > 8 * 1024 * 1024)
    throw new Error('请选择小于 8 MB 的照片')
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  const jpeg = bytes[0] === 0xFF && bytes[1] === 0xD8
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  if (!jpeg && !png && !webp)
    throw new Error('请选择 JPG、PNG 或 WebP 图片')
  const bitmap = await createImageBitmap(file)
  try {
    if (bitmap.width * bitmap.height > 24_000_000 || bitmap.width < 32 || bitmap.height < 32)
      throw new Error('照片尺寸需至少为 32 × 32，且不超过 2400 万像素')
  }
  finally { bitmap.close() }
  return URL.createObjectURL(file)
}

export async function cropResumePhoto(image: HTMLImageElement, crop: PercentCrop): Promise<ResumePhoto> {
  const sx = image.naturalWidth * crop.x / 100
  const sy = image.naturalHeight * crop.y / 100
  const sw = image.naturalWidth * crop.width / 100
  const sh = image.naturalHeight * crop.height / 100
  if (![sx, sy, sw, sh].every(Number.isFinite) || sw < 1 || sh < 1 || sx < 0 || sy < 0 || sx + sw > image.naturalWidth + 1 || sy + sh > image.naturalHeight + 1)
    throw new Error('请先选择有效的照片区域')
  const scale = Math.min(1, RESUME_PHOTO_MAX_EDGE / Math.max(sw, sh))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(sw * scale))
  canvas.height = Math.max(1, Math.round(sh * scale))
  const context = canvas.getContext('2d')
  if (!context)
    throw new Error('当前浏览器无法处理照片')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  for (const quality of [0.9, 0.8, 0.7, 0.6, 0.5, 0.4]) {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (blob && blob.size <= RESUME_PHOTO_MAX_BYTES) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(new Error('照片读取失败'))
        reader.onload = () => resolve(String(reader.result))
        reader.readAsDataURL(blob)
      })
      return resumePhotoSchema.parse({ dataUrl, width: canvas.width, height: canvas.height })
    }
  }
  throw new Error('照片细节过多，请裁切更小的区域后重试')
}
