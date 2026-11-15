import { useEffect, useState } from 'react'
import { PhotoSlider } from 'react-photo-view'
import { Expand, X, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { usePortalContainer } from '@/components/ui/portal-container'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import 'react-photo-view/dist/react-photo-view.css'

export default function ImagePreview({
  blob,
  name,
}: {
  blob: Blob
  name: string
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const next = URL.createObjectURL(blob)

    setUrl(next)
    setFailed(false)

    return () => URL.revokeObjectURL(next)
  }, [blob])

  if (!url) return null

  return (
    <div className='space-y-3'>
      {failed ? (
        <p
          role='alert'
          className='rounded-lg border p-6 text-sm text-muted-foreground'
        >
          浏览器无法显示这张图片，可以下载原件查看。
        </p>
      ) : (
        <button
          type='button'
          className='group relative flex w-full items-center justify-center overflow-hidden rounded-lg border bg-muted/30'
          aria-label={`放大查看 ${name}`}
          onClick={() => setOpen(true)}
        >
          <img
            src={url}
            alt={name}
            className='max-h-[65dvh] max-w-full object-contain'
            onError={() => setFailed(true)}
          />
          <span className='absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-md border bg-background/90 px-2 py-1 text-xs'>
            <Expand className='size-3.5' />
            放大查看
          </span>
        </button>
      )}
      <p className='text-xs text-muted-foreground'>
        图片原件已保存，暂不识别图中文字。
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className='h-dvh w-screen max-w-none rounded-none border-0 bg-transparent p-0 ring-0 sm:max-w-none'
          overlayClassName='bg-transparent'
        >
          <DialogTitle className='sr-only'>{name}</DialogTitle>
          <DialogDescription className='sr-only'>
            查看图片，可缩放；按 Escape 关闭。
          </DialogDescription>
          <ImageLightbox
            url={url}
            name={name}
            open={open}
            onClose={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ImageLightbox({
  url,
  name,
  open,
  onClose,
}: {
  url: string
  name: string
  open: boolean
  onClose: () => void
}) {
  const container = usePortalContainer()
  const reduced = useReducedMotion()

  if (!container) return null

  return (
    <PhotoSlider
      images={[{ key: url, src: url }]}
      visible={open}
      onClose={onClose}
      portalContainer={container}
      bannerVisible={false}
      speed={() => (reduced ? 0 : DURATION.base * 1000)}
      easing={() => `cubic-bezier(${EASE.out.join(',')})`}
      loadingElement={<Spinner className='text-white' />}
      brokenElement={
        <p className='text-white'>图片无法显示，请下载原件查看。</p>
      }
      overlayRender={({ scale, onScale }) => (
        <div className='absolute top-0 right-0 left-0 z-20 flex items-center justify-between gap-3 bg-black/60 p-3 text-white'>
          <p className='min-w-0 truncate text-sm'>{name}</p>
          <div className='flex shrink-0 gap-1'>
            <Button
              variant='ghost'
              size='icon'
              aria-label='缩小图片'
              disabled={scale <= 1}
              onClick={() => onScale(Math.max(1, scale - 0.5))}
            >
              <ZoomOut />
            </Button>
            <Button
              variant='ghost'
              size='icon'
              aria-label='放大图片'
              disabled={scale >= 5}
              onClick={() => onScale(Math.min(5, scale + 0.5))}
            >
              <ZoomIn />
            </Button>
            <Button
              variant='ghost'
              size='icon'
              aria-label='关闭图片预览'
              onClick={onClose}
            >
              <X />
            </Button>
          </div>
        </div>
      )}
    />
  )
}
