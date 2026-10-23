import type { RefObject } from 'react'
import type { TemplateSwitchPreviewState } from '../template-switch-preview'
import { ArrowRight, ImageOff, LoaderCircle, Undo2 } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'
import AnimatedContent from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useIsMobile } from '@/hooks/use-mobile'
import { DURATION, EASE } from '@/lib/motion'
import { templateKey } from '@/lib/resume-template/source/types'
import { cn } from '@/lib/utils'
import { useResumeTemplateStore } from '@/store/resume-template'
import useResumeConfigStore from '@/store/resume/config'
import useResumeStore from '@/store/resume/form'
import { useTemplateCatalogEntry } from '../../hooks/use-template-catalog-entry'
import { useTemplateSwitchStore } from '../../template-switch/store'
import { createTemplateSwitchContentKey, sameTemplateBinding, templateHasPhoto, templateSwitchReferenceDate } from '../../template-switch/utils'
import TemplateSwitchGallery from '../template-switch-gallery'
import TemplateSwitchPreview from '../template-switch-preview'

function DialogBody() {
  const live = useResumeStore()
  // 外观单独存储；协作/本地外观变化也必须使预览就绪证据失效。
  useResumeConfigStore()
  const state = useTemplateSwitchStore()
  const binding = state.selectedBinding ?? live.templateBinding
  const current = useTemplateCatalogEntry(live.templateBinding?.templateId)
  const selected = useTemplateCatalogEntry(binding?.templateId)
  const definition = useResumeTemplateStore(store => binding ? store.definitions[templateKey(binding)] : undefined)
  const reduceMotion = useReducedMotion()
  const isMobile = useIsMobile()
  const [mobileTab, setMobileTab] = useState<'list' | 'preview'>('list')
  const [prepared, setPrepared] = useState<TemplateSwitchPreviewState | null>(null)
  const snapshot = live.getPersistedSnapshot()
  const referenceDate = templateSwitchReferenceDate()
  const contentKey = binding ? createTemplateSwitchContentKey(snapshot, binding, referenceDate) : ''
  const ready = prepared?.contentKey === contentKey && prepared.document.status === 'ready' && !!prepared.document.signature
  const previewError = prepared?.contentKey === contentKey && prepared.document.status === 'error'
  const same = sameTemplateBinding(binding, live.templateBinding)
  const pageCount = ready ? prepared.document.signature?.pages.length : undefined
  const name = selected.item?.name ?? '所选模板'
  const noPhoto = !!snapshot.basics.photo && definition?.status === 'ready' && !templateHasPhoto(definition.data)
  const currentName = current.item?.name ?? '当前模板'
  const apply = () => {
    if (!ready || !binding)
      return
    if (!state.applyTemplate({ binding, contentKey })) {
      toast.error('暂未更换模板，请等待最新预览就绪后重试')
      return
    }
    const record = useTemplateSwitchStore.getState().undoRecord
    toast.success(`已更换为${name}`, {
      description: '简历内容与外观设置已保留',
      actionButtonStyle: { backgroundColor: 'var(--destructive)', color: 'var(--background)' },
      action: record
        ? {
            label: '撤销',
            onClick: () => {
              if (useTemplateSwitchStore.getState().undoTemplate(record.operationId))
                toast.success('已撤销模板更换')
              else
                toast.info('简历状态已变化，无法撤销这次更换')
            },
          }
        : undefined,
    })
  }
  return (
    <>
      <DialogHeader className="shrink-0 border-b p-5 pr-14 md:px-6">
        <DialogTitle className="text-lg">更换模板</DialogTitle>
        <DialogDescription>
          当前使用：
          {currentName}
          。预览当前简历，应用后生效。
        </DialogDescription>
      </DialogHeader>
      <div className="flex shrink-0 gap-1 border-b bg-muted/30 p-2 md:hidden" role="tablist" aria-label="模板选择视图">
        <Button id="template-switch-list-tab" role="tab" aria-controls="template-switch-gallery-panel" aria-selected={mobileTab === 'list'} variant={mobileTab === 'list' ? 'secondary' : 'ghost'} size="sm" className="flex-1" onClick={() => setMobileTab('list')}>选择模板</Button>
        <Button id="template-switch-preview-tab" role="tab" aria-controls="template-switch-preview-panel" aria-selected={mobileTab === 'preview'} variant={mobileTab === 'preview' ? 'secondary' : 'ghost'} size="sm" className="flex-1" onClick={() => setMobileTab('preview')}>
          简历预览
          {pageCount ? ` · ${pageCount} 页` : ''}
        </Button>
      </div>
      {state.conflictBinding && (
        <p role="status" className="shrink-0 border-b bg-muted/40 px-5 py-2 text-xs">
          当前模板已更换为
          {currentName}
          ，已保留你的预览选择。
        </p>
      )}
      <div className="relative flex min-h-0 flex-1">
        <motion.section
          id="template-switch-preview-panel"
          aria-label="当前简历真实内容预览"
          aria-hidden={isMobile && mobileTab !== 'preview'}
          inert={isMobile && mobileTab !== 'preview'}
          animate={{ opacity: isMobile && mobileTab !== 'preview' ? 0 : 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : DURATION.base, ease: EASE.out }}
          className={cn('absolute inset-0 flex min-h-0 min-w-0 flex-1 flex-col bg-muted/20 md:static', isMobile && mobileTab !== 'preview' && 'pointer-events-none')}
        >
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-xs">
            <span className="min-w-0 flex-1 truncate font-medium" title={`预览：${name}`}>
              预览：
              {name}
            </span>
            <span role="status" aria-live="polite" className="flex h-5 min-w-20 shrink-0 items-center justify-end text-muted-foreground">
              <AnimatedContent animationKey={ready ? 'ready' : previewError ? 'error' : 'loading'} as="span" className="inline-flex items-center gap-1.5 whitespace-nowrap">
                {ready
                  ? `共 ${pageCount} 页`
                  : previewError
                    ? '预览暂不可用'
                    : (
                        <>
                          <LoaderCircle aria-hidden className={cn('size-3', !reduceMotion && 'animate-spin')} />
                          准备中
                          <span className="sr-only">，完成后自动更新预览</span>
                        </>
                      )}
              </AnimatedContent>
            </span>
            {noPhoto && (
              <p className="flex w-full items-center gap-1.5 text-muted-foreground">
                <ImageOff className="size-3.5 shrink-0" />
                此模板不展示照片，照片仍会保留
              </p>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-auto overscroll-contain p-3 md:p-6">
            {binding && <TemplateSwitchPreview snapshot={snapshot} binding={binding} contentKey={contentKey} referenceDate={referenceDate} onStateChange={setPrepared} />}
          </div>
        </motion.section>
        <motion.aside
          id="template-switch-gallery-panel"
          aria-label="可用简历模板"
          aria-hidden={isMobile && mobileTab !== 'list'}
          inert={isMobile && mobileTab !== 'list'}
          animate={{ opacity: isMobile && mobileTab !== 'list' ? 0 : 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : DURATION.base, ease: EASE.out }}
          className={cn('absolute inset-0 flex min-h-0 min-w-0 flex-col bg-background md:static md:w-80 md:shrink-0 md:border-l lg:w-96', isMobile && mobileTab !== 'list' && 'pointer-events-none')}
        >
          <TemplateSwitchGallery />
        </motion.aside>
      </div>
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t bg-background p-4 md:px-6">
        <p className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
          <Undo2 className="size-3.5" />
          应用后可撤销，内容与外观设置保持不变
        </p>
        <div className="flex w-full justify-end gap-2 md:w-auto">
          <Button variant="outline" onClick={state.closeDialog}>取消</Button>
          <Button disabled={!state.open || !ready || same} onClick={apply}>
            {same ? '当前正在使用' : state.conflictBinding ? '仍应用所选模板' : '应用模板'}
            {!same && <ArrowRight className="size-4" />}
          </Button>
        </div>
      </footer>
    </>
  )
}

export default function TemplateSwitchDialog({ triggerRef }: { triggerRef: RefObject<HTMLButtonElement | null> }) {
  const open = useTemplateSwitchStore(state => state.open)
  const close = useTemplateSwitchStore(state => state.closeDialog)
  const reduceMotion = useReducedMotion()
  return (
    <Dialog open={open} onOpenChange={next => !next && close()}>
      <DialogContent
        className="flex h-[94dvh] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 md:h-[90dvh] md:max-w-[min(1400px,calc(100%-4rem))]"
        overlayClassName={reduceMotion ? 'animate-none! duration-0!' : undefined}
        style={{ animationDuration: `${reduceMotion ? 0 : open ? DURATION.base : DURATION.fast}s`, animationTimingFunction: `cubic-bezier(${(open ? EASE.out : EASE.in).join(',')})` }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          triggerRef.current?.focus()
        }}
      >
        <DialogBody />
      </DialogContent>
    </Dialog>
  )
}
