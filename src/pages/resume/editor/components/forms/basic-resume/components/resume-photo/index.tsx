import type { UseFormReturn } from 'react-hook-form'
import type { PercentCrop } from 'react-image-crop'
import type { BasicFormInput } from '@/lib/schema'
import { ImagePlus, LoaderCircle, Trash2 } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useWatch } from 'react-hook-form'
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { cropResumePhoto, readPhotoFile } from './utils'
import 'react-image-crop/dist/ReactCrop.css'

export function ResumePhotoField({
  form,
}: {
  form: UseFormReturn<BasicFormInput>
}) {
  const photo = useWatch({ control: form.control, name: 'photo' })
  const [source, setSource] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [crop, setCrop] = useState<PercentCrop>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const imageRef = useRef<HTMLImageElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const requestRef = useRef(0)
  const mountedRef = useRef(true)
  const reduceMotion = useReducedMotion()
  useEffect(
    () => () => {
      if (source) URL.revokeObjectURL(source)
    },
    [source],
  )
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])
  const choose = async (file?: File) => {
    if (!file) return
    const request = ++requestRef.current
    setBusy(true)
    setError('')
    try {
      const url = await readPhotoFile(file)
      if (!mountedRef.current || requestRef.current !== request) {
        URL.revokeObjectURL(url)
        return
      }
      setCrop(undefined)
      setSource(url)
      setOpen(true)
    } catch (caught) {
      if (mountedRef.current && requestRef.current === request)
        setError(
          caught instanceof Error ? caught.message : '照片读取失败，请重新选择',
        )
    } finally {
      if (mountedRef.current && requestRef.current === request) setBusy(false)
    }
  }
  const save = async () => {
    if (!imageRef.current || !crop) return
    const request = ++requestRef.current
    setBusy(true)
    setError('')
    try {
      const next = await cropResumePhoto(imageRef.current, crop)
      if (!mountedRef.current || requestRef.current !== request) return
      form.setValue('photo', next, { shouldDirty: true, shouldValidate: true })
      setOpen(false)
    } catch (caught) {
      if (mountedRef.current && requestRef.current === request)
        setError(
          caught instanceof Error ? caught.message : '照片保存失败，请重试',
        )
    } finally {
      if (mountedRef.current && requestRef.current === request) setBusy(false)
    }
  }
  const close = (next: boolean) => {
    if (!next) {
      requestRef.current++
      setBusy(false)
    }
    setOpen(next)
  }
  return (
    <div className='mb-6 flex items-start gap-4' data-resume-photo-editor>
      <div className='flex h-24 w-18 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40'>
        <AnimatePresence mode='wait' initial={false}>
          <motion.div
            key={photo?.dataUrl ?? 'empty'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: reduceMotion ? 0 : DURATION.fast,
              ease: EASE.out,
            }}
            className='flex size-full items-center justify-center'
          >
            {photo ? (
              <img
                src={photo.dataUrl}
                alt='简历照片'
                className='size-full object-cover'
              />
            ) : (
              <ImagePlus aria-hidden className='size-6 text-muted-foreground' />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className='min-w-0 space-y-2'>
        <p className='text-sm font-medium'>简历照片</p>
        <p className='text-xs text-muted-foreground'>
          选填，支持 JPG、PNG、WebP。照片会随简历保存。
        </p>
        <input
          ref={inputRef}
          type='file'
          aria-label='选择简历照片'
          accept='image/jpeg,image/png,image/webp'
          className='sr-only'
          onChange={(event) => {
            choose(event.currentTarget.files?.[0])
            event.currentTarget.value = ''
          }}
        />
        <div className='flex flex-wrap gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy && (
              <LoaderCircle
                className={cn('size-3.5', !reduceMotion && 'animate-spin')}
              />
            )}
            {photo ? '替换照片' : '选择照片'}
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            disabled={!photo || busy}
            onClick={() =>
              form.setValue('photo', null, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          >
            <Trash2 className='size-3.5' />
            移除
          </Button>
        </div>
        {!open && error && (
          <p role='alert' className='text-xs text-destructive'>
            {error}
          </p>
        )}
      </div>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent
          className='sm:max-w-lg'
          style={reduceMotion ? { animationDuration: '0s' } : undefined}
          overlayClassName={reduceMotion ? 'animate-none!' : undefined}
        >
          <DialogHeader>
            <DialogTitle>裁切简历照片</DialogTitle>
            <DialogDescription>
              拖动选框选择要保留的区域，模板会按自己的照片框展示。
            </DialogDescription>
          </DialogHeader>
          <div className='flex max-h-[55vh] justify-center overflow-auto rounded-md bg-muted/30 p-2'>
            {source && (
              <ReactCrop
                crop={crop}
                onChange={(_pixels, percent) => setCrop(percent)}
                aspect={3 / 4}
                minWidth={32}
                keepSelection
                disabled={busy}
              >
                <img
                  ref={imageRef}
                  src={source}
                  alt='待裁切照片'
                  className='max-h-[50vh] max-w-full'
                  onLoad={(event) => {
                    const { width, height } = event.currentTarget
                    setCrop(
                      centerCrop(
                        makeAspectCrop(
                          { unit: '%', width: 80 },
                          3 / 4,
                          width,
                          height,
                        ),
                        width,
                        height,
                      ),
                    )
                  }}
                  onError={() => setError('照片无法解码，请重新选择')}
                />
              </ReactCrop>
            )}
          </div>
          {error && (
            <p role='alert' className='text-sm text-destructive'>
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => close(false)}
            >
              取消
            </Button>
            <Button type='button' disabled={busy || !crop} onClick={save}>
              {busy ? '处理照片…' : '使用照片'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
