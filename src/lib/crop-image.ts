export type AvatarCropShape = 'square' | 'circle'

export interface PercentCrop {
  x: number
  y: number
  width: number
  height: number
}

interface CreateCroppedImageFileOptions {
  imageSrc: string
  crop: PercentCrop
  fileName: string
  shape?: AvatarCropShape
  mimeType?: string
  outputSize?: number
}

const IMAGE_MIME_TYPE_MAP = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const

function resolveExportMimeType(shape: AvatarCropShape, mimeType?: string) {
  if (shape === 'circle') return 'image/png'

  if (mimeType && mimeType in IMAGE_MIME_TYPE_MAP)
    return mimeType as keyof typeof IMAGE_MIME_TYPE_MAP

  return 'image/jpeg'
}

function createImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()

    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片加载失败，请重新选择'))
    image.src = src
  })
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '') || 'avatar'
}

export async function createCroppedImageFile({
  imageSrc,
  crop,
  fileName,
  shape = 'square',
  mimeType,
  outputSize = 512,
}: CreateCroppedImageFileOptions) {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) throw new Error('当前浏览器不支持头像裁剪')

  const exportMimeType = resolveExportMimeType(shape, mimeType)
  const sourceX = image.naturalWidth * (crop.x / 100)
  const sourceY = image.naturalHeight * (crop.y / 100)
  const sourceWidth = image.naturalWidth * (crop.width / 100)
  const sourceHeight = image.naturalHeight * (crop.height / 100)

  canvas.width = outputSize
  canvas.height = outputSize

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  if (shape === 'circle') {
    context.beginPath()
    context.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2)
    context.closePath()
    context.clip()
  }
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    outputSize,
    outputSize,
  )

  const blob = await new Promise<Blob>((resolve, reject) => {
    context.canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error('头像裁剪失败，请稍后重试'))
          return
        }

        resolve(result)
      },
      exportMimeType,
      exportMimeType === 'image/jpeg' ? 0.92 : undefined,
    )
  })

  return new File(
    [blob],
    `${stripExtension(fileName)}.${IMAGE_MIME_TYPE_MAP[exportMimeType]}`,
    {
      type: exportMimeType,
      lastModified: Date.now(),
    },
  )
}
