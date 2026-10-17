import type { SyntheticEvent } from 'react'
import type { PercentCrop } from 'react-image-crop'
import type { AvatarCropShape, AvatarPercentCrop } from '../../types'
import { useEffect, useState } from 'react'
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import 'react-image-crop/dist/ReactCrop.css'

interface AvatarCropDialogProps {
  open: boolean
  image: string | null
  submitting?: boolean
  onConfirm: (crop: AvatarPercentCrop, shape: AvatarCropShape) => Promise<void> | void
  onOpenChange: (open: boolean) => void
}

function createCenteredSquareCrop(mediaWidth: number, mediaHeight: number) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 70,
      },
      1,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

export function AvatarCropDialog({
  open,
  image,
  submitting = false,
  onConfirm,
  onOpenChange,
}: AvatarCropDialogProps) {
  const [cropShape, setCropShape] = useState<AvatarCropShape>('circle')
  const [crop, setCrop] = useState<PercentCrop>()
  const [completedCrop, setCompletedCrop] = useState<AvatarPercentCrop | null>(null)

  useEffect(() => {
    setCropShape('circle')
    setCrop(undefined)
    setCompletedCrop(null)
  }, [image])

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget
    const nextCrop = createCenteredSquareCrop(naturalWidth, naturalHeight)

    setCrop(nextCrop)
    setCompletedCrop({
      x: nextCrop.x,
      y: nextCrop.y,
      width: nextCrop.width,
      height: nextCrop.height,
    })
  }

  const handleConfirm = async () => {
    if (!completedCrop)
      return

    await onConfirm(completedCrop, cropShape)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[min(96vw,52rem)] gap-0 overflow-hidden p-0"
        showCloseButton={!submitting}
      >
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>裁剪头像</DialogTitle>
          <DialogDescription className="sr-only">调整裁剪范围并保存头像。</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={cropShape === 'circle' ? 'default' : 'outline'}
              onClick={() => setCropShape('circle')}
              disabled={submitting}
            >
              圆形
            </Button>
            <Button
              type="button"
              size="sm"
              variant={cropShape === 'square' ? 'default' : 'outline'}
              onClick={() => setCropShape('square')}
              disabled={submitting}
            >
              方形
            </Button>
          </div>

          <div className="max-h-[min(68vh,34rem)] overflow-auto rounded-2xl border bg-muted/35 p-4">
            {image && (
              <ReactCrop
                crop={crop}
                aspect={1}
                minWidth={120}
                keepSelection
                circularCrop={cropShape === 'circle'}
                ruleOfThirds
                onChange={(_, percentCrop) => {
                  setCrop(percentCrop)
                  setCompletedCrop({
                    x: percentCrop.x,
                    y: percentCrop.y,
                    width: percentCrop.width,
                    height: percentCrop.height,
                  })
                }}
                onComplete={(_, percentCrop) => {
                  setCompletedCrop({
                    x: percentCrop.x,
                    y: percentCrop.y,
                    width: percentCrop.width,
                    height: percentCrop.height,
                  })
                }}
              >
                <img
                  src={image}
                  alt="待裁剪头像"
                  onLoad={handleImageLoad}
                  className="mx-auto block max-h-[min(60vh,30rem)] max-w-full object-contain"
                />
              </ReactCrop>
            )}
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!image || !completedCrop || submitting} aria-busy={submitting}>
            <AnimatedContent as="span" animationKey={submitting ? 'saving' : 'idle'} className="inline-flex items-center gap-2">
              {submitting && <Spinner className="size-4" />}
              保存头像
            </AnimatedContent>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
