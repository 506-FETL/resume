import { useCallback, useEffect, useRef, useState } from 'react'
import { usePreviewDrawer } from '../../hooks/use-preview-drawer'
import { X } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import AnimatedContent from '@/components/motion/animated-content'
import PreviewPlaceholder from '../preview-placeholder'
import { clearPreviewPaper } from '../../store/preview-paper'
import { useTemplateGalleryCatalog } from '@/store/resume-template/gallery-catalog'
import { Button } from '@/components/ui/button'
import { createDeferredComponent } from '@/components/deferred-content'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { DURATION } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type {
  TemplateCardSummary,
  TemplateCatalogItem,
} from '@/lib/resume-template/source/types'
import { useTemplatePageStore } from '../../store'
import { prefetchTemplatePreview } from '../../utils'

const previewSkeleton = <PreviewPlaceholder />

const Content = createDeferredComponent(
  () => import('./content'),
  '模板预览',
  previewSkeleton,
  { wrapFallback: false },
)

type DetailResult =
  | { target: TemplateCardSummary; item: TemplateCatalogItem }
  | { target: TemplateCardSummary; error: string; changed?: boolean }

export default function TemplatePreviewDialog() {
  const target = useTemplatePageStore((state) => state.previewTarget)
  const previewOpen = useTemplatePageStore((state) => state.previewOpen)
  const { setPreviewOpen } = useTemplatePageStore.getState()
  const previewTrigger = useTemplatePageStore((state) => state.previewTrigger)

  const details = useTemplatePageStore(
    (state) => state.previewStep === 'details',
  )

  const [result, setResult] = useState<DetailResult | null>(null)
  const [attempt, setAttempt] = useState(0)
  const isMobile = useIsMobile()

  const {
    drawer,
    failed: drawerFailed,
    retry: retryDrawer,
  } = usePreviewDrawer(isMobile)

  const reduceMotion = useReducedMotion()
  const desktopTitleRef = useRef<HTMLHeadingElement>(null)
  const mobileTitleRef = useRef<HTMLHeadingElement>(null)
  const previousAttemptRef = useRef(attempt)

  const cancelDrawerOpening = useCallback(() => {
    setPreviewOpen(false)

    if (previewTrigger?.isConnected)
      previewTrigger.focus({ preventScroll: true })
  }, [previewTrigger, setPreviewOpen])

  useEffect(() => clearPreviewPaper, [])

  useEffect(() => {
    if (!isMobile || !previewOpen || drawer) return

    Content.preload().catch(() => {})

    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelDrawerOpening()
    }

    window.addEventListener('keydown', cancel)

    return () => window.removeEventListener('keydown', cancel)
  }, [drawer, isMobile, previewOpen, cancelDrawerOpening])

  useEffect(() => {
    if (!target || !previewOpen) return

    let active = true
    const force = previousAttemptRef.current !== attempt

    previousAttemptRef.current = attempt

    const example =
      useTemplatePageStore.getState().selectedExamples[target.templateId]
        ?.example ?? target.defaultExample

    prefetchTemplatePreview(target, example).catch(() => {})

    import('@/lib/resume-template/source')
      .then(({ resumeTemplateSource }) =>
        resumeTemplateSource.getTemplateCatalogEntry(target.templateId, {
          force,
        }),
      )
      .then((entry) => {
        if (
          !entry?.listed ||
          entry.item.currentVersion !== target.currentVersion
        ) {
          if (active) {
            const catalog = useTemplateGalleryCatalog.getState()

            catalog.loadCatalog(catalog.catalogQuery, true)

            setResult({
              target,
              changed: true,
              error: '这套模板的发布信息已更新，请返回列表重新选择。',
            })
          }

          return
        }
        if (active) setResult({ target, item: entry.item })
      })
      .catch((error: unknown) => {
        if (active)
          setResult({
            target,
            error:
              error instanceof Error ? error.message : '暂时无法加载模板详情。',
          })
      })

    return () => {
      active = false
    }
  }, [target, previewOpen, attempt])

  if (!target) return null

  const current = result?.target === target ? result : null

  function panel(mobile: boolean) {
    const Header = mobile && drawer ? drawer.DrawerHeader : DialogHeader
    const Title = mobile && drawer ? drawer.DrawerTitle : DialogTitle

    const Description =
      mobile && drawer ? drawer.DrawerDescription : DialogDescription

    const titleRef = mobile ? mobileTitleRef : desktopTitleRef

    return (
      <>
        <Header className='relative shrink-0 gap-2 border-b px-5 py-5 pr-14 text-left! sm:px-6 sm:pr-14'>
          <Title
            ref={titleRef}
            tabIndex={-1}
            className='text-lg font-semibold outline-none'
          >
            <AnimatedContent
              animationKey={details ? 'details' : 'preview'}
              as='span'
            >
              {details ? '填写简历信息' : target?.name}
            </AnimatedContent>
          </Title>
          <Description>
            {details
              ? '名称和描述都可以留空。'
              : '预览完整排版，选择示例后开始填写。'}
          </Description>
          {mobile && (
            <Button
              aria-label='关闭预览'
              variant='ghost'
              size='icon-sm'
              onClick={() => setPreviewOpen(false)}
              className='absolute top-4 right-4 motion-reduce:transform-none'
              style={{
                transitionDuration: reduceMotion ? '0s' : `${DURATION.base}s`,
              }}
            >
              <X aria-hidden className='size-4' />
            </Button>
          )}
        </Header>
        {current && 'error' in current && current.changed ? (
          <div className='m-auto space-y-3 text-center'>
            <p role='alert'>{current.error}</p>
            <Button variant='outline' onClick={() => setPreviewOpen(false)}>
              返回列表
            </Button>
          </div>
        ) : (
          target && (
            <Content
              key={target.templateId + '@' + target.currentVersion}
              item={target}
              entry={current && 'item' in current ? current.item : undefined}
              mobile={mobile}
              Footer={mobile && drawer ? drawer.DrawerFooter : DialogFooter}
              titleRef={titleRef}
            />
          )
        )}
        {current && 'error' in current && !current.changed && (
          <div className='flex items-center justify-center gap-3 border-t p-3'>
            <p role='alert'>模板详情加载失败</p>
            <Button
              variant='outline'
              size='sm'
              onClick={() => {
                setResult(null)
                setAttempt((value) => value + 1)
              }}
            >
              重试
            </Button>
          </div>
        )}
      </>
    )
  }

  // 抽屉首次只在窄屏准备；加载后保留 Root，跨断点时仍有退出动画。
  return (
    <>
      {drawer ? (
        <drawer.Drawer
          open={isMobile && previewOpen}
          onOpenChange={setPreviewOpen}
          showSwipeHandle
        >
          <drawer.DrawerContent
            className={cn(
              'overflow-clip rounded-t-2xl rounded-b-none duration-(--ui-motion-slow) [--drawer-inset:0px] data-[swipe-axis=y]:[--drawer-content-height:92dvh] data-[swipe-axis=y]:[--drawer-content-max-height:92dvh] data-ending-style:duration-(--ui-motion-fast)',
              reduceMotion && 'transition-none!',
            )}
            overlayClassName={cn(
              'duration-(--ui-motion-slow) data-ending-style:duration-(--ui-motion-fast)',
              reduceMotion && 'transition-none!',
            )}
            finalFocus={() =>
              isMobile && previewTrigger?.isConnected ? previewTrigger : false
            }
          >
            {panel(true)}
          </drawer.DrawerContent>
        </drawer.Drawer>
      ) : (
        isMobile &&
        previewOpen && (
          <div className='fixed inset-x-4 bottom-4 z-50 flex items-center justify-center gap-3 rounded-lg border bg-popover p-3 shadow-md'>
            <span role={drawerFailed ? 'alert' : 'status'}>
              {drawerFailed ? '暂时无法打开模板预览' : '正在打开模板预览…'}
            </span>
            {drawerFailed && (
              <Button size='sm' variant='outline' onClick={retryDrawer}>
                重试
              </Button>
            )}
            <Button size='sm' variant='ghost' onClick={cancelDrawerOpening}>
              取消
            </Button>
          </div>
        )
      )}
      <Dialog open={!isMobile && previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent
          className='flex h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl'
          style={reduceMotion ? { animationDuration: '0s' } : undefined}
          onCloseAutoFocus={(event) => {
            if (isMobile) {
              event.preventDefault()

              return
            }
            if (previewTrigger?.isConnected) {
              event.preventDefault()
              previewTrigger.focus()
            }
          }}
        >
          {panel(false)}
        </DialogContent>
      </Dialog>
    </>
  )
}
