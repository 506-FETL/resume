import { useCallback, useState } from 'react'
import type { ExperienceSourceReadResult } from '@/lib/experience-sources/types'
import type { CSSProperties } from 'react'
import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerClose,
  DrawerDescription,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { createDeferredComponent } from '@/components/deferred-content'
import { useExperienceSourcesStore } from '@/store/experience-sources'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { useIsMobile } from '@/hooks/use-mobile'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import useAssistantStore from '../../store'

const ExperienceSourceReader = createDeferredComponent(
  () =>
    import('@/features/experience-sources/source-reader').then(
      ({ ExperienceSourceReader }) => ({ default: ExperienceSourceReader }),
    ),
  '资料正文',
)

const ExperienceOriginalPreview = createDeferredComponent(
  () => import('@/features/experience-sources/original-preview'),
  '原件预览',
)

export default function SourceViewer() {
  const [detail, setDetail] = useState<ExperienceSourceReadResult | null>(null)
  const [downloading, setDownloading] = useState(false)
  const source = useAssistantStore((state) => state.sourceViewer)
  const isMobile = useIsMobile()
  const reduced = useReducedMotion()
  const navigate = useNavigate()

  const onLoaded = useCallback((result: ExperienceSourceReadResult) => {
    setDetail(result)

    useAssistantStore.setState((state) => ({
      sourceViewer:
        state.sourceViewer?.sourceId === result.source.id &&
        state.sourceViewer.versionId === result.version.id
          ? { ...state.sourceViewer, name: result.source.name }
          : state.sourceViewer,
    }))
  }, [])

  if (!source) return null

  const setOpen = (open: boolean) =>
    useAssistantStore.setState((state) => ({
      sourceViewer: state.sourceViewer ? { ...state.sourceViewer, open } : null,
    }))

  const returnFocus = () =>
    source.returnFocus?.isConnected
      ? source.returnFocus
      : document.querySelector<HTMLTextAreaElement>('[data-composer] textarea')

  const version =
    detail?.source.id === source.sourceId &&
    detail.version.id === source.versionId
      ? detail.version
      : null

  async function download() {
    if (!version) return

    const generation = useExperienceSourcesStore.getState().generation

    setDownloading(true)

    try {
      const blob = await useExperienceSourcesStore
        .getState()
        .original(source!.sourceId, version.id)

      if (useExperienceSourcesStore.getState().generation !== generation) return

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')

      anchor.href = url
      anchor.download = version.fileName ?? source!.name
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      if (useExperienceSourcesStore.getState().generation === generation)
        toast.error(error instanceof Error ? error.message : '下载失败，请重试')
    } finally {
      setDownloading(false)
    }
  }

  const body = (
    <>
      <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-5'>
        {version?.fileName && !source.blockId && (
          <ExperienceOriginalPreview
            key={version.id}
            sourceId={source.sourceId}
            version={version}
          />
        )}
        <ExperienceSourceReader
          sourceId={source.sourceId}
          versionId={source.versionId}
          blockId={source.blockId}
          onLoaded={onLoaded}
        />
      </div>
      <div className='flex shrink-0 justify-end gap-2 border-t p-3'>
        {version && (
          <Button
            variant='outline'
            size='sm'
            disabled={downloading}
            onClick={download}
          >
            {downloading && <Spinner />}下载原件
          </Button>
        )}
        {version && !detail?.source.conversationId && (
          <Button
            variant='ghost'
            size='sm'
            onClick={() => {
              setOpen(false)

              navigate(
                `/experience?${new URLSearchParams({ sourceId: source.sourceId, versionId: source.versionId, ...(source.blockId ? { blockId: source.blockId } : {}) })}`,
              )
            }}
          >
            在职业档案中管理
          </Button>
        )}
      </div>
    </>
  )

  if (isMobile) {
    return (
      <Drawer open={source.open} onOpenChange={setOpen}>
        <DrawerContent
          className='flex-col! gap-0 overflow-hidden p-0'
          finalFocus={returnFocus}
          style={
            { '--drawer-content-height': 'min(85dvh, 48rem)' } as CSSProperties
          }
        >
          <DrawerHeader className='relative shrink-0 border-b pr-14 text-left'>
            <DrawerTitle className='wrap-break-word'>{source.name}</DrawerTitle>
            <DrawerDescription className='sr-only'>
              查看引用的资料原文。
            </DrawerDescription>
            <DrawerClose
              render={
                <Button
                  variant='ghost'
                  size='icon-sm'
                  className='absolute top-3 right-3'
                  aria-label='关闭资料原文'
                />
              }
            >
              <X />
            </DrawerClose>
          </DrawerHeader>
          {body}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={source.open} onOpenChange={setOpen}>
      <DialogContent
        className='flex h-[min(85dvh,48rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl'
        style={reduced ? { animationDuration: '0s' } : undefined}
        overlayClassName={reduced ? 'animate-none!' : undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocus()?.focus({ preventScroll: true })
        }}
      >
        <DialogHeader className='shrink-0 border-b p-5 pr-14'>
          <DialogTitle className='wrap-break-word'>{source.name}</DialogTitle>
          <DialogDescription className='sr-only'>
            查看引用的资料原文。
          </DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  )
}
