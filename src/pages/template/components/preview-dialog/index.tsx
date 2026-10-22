import type { TemplateCatalogItem } from '@/lib/resume-template/source/types'
import { ArrowRight, X } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import AnimatedContent from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useIsMobile } from '@/hooks/use-mobile'
import { DURATION } from '@/lib/motion'
import { exampleKey } from '@/lib/resume-template/source/types'
import { cn } from '@/lib/utils'
import { useTemplateCreation } from '../../hooks/use-template-creation'
import { useTemplatePageStore } from '../../store.ts'
import ExamplePicker from '../example-picker'
import ExamplePreview from '../example-preview'

export default function PreviewDialog({ item }: { item: TemplateCatalogItem }) {
  const { previewOpen, setPreviewOpen, previewTrigger, selectedExamples, selectExample } = useTemplatePageStore()
  const selectedExample = selectedExamples[item.templateId] ?? item.defaultExample
  const category = item.category
  const creation = useTemplateCreation(item)
  const isMobile = useIsMobile()
  const reduceMotion = useReducedMotion()
  const transitionStyle = { transitionDuration: reduceMotion ? '0s' : `${DURATION.base}s` }
  function renderContent(mobile: boolean) {
    const Header = mobile ? DrawerHeader : DialogHeader
    const Title = mobile ? DrawerTitle : DialogTitle
    const Description = mobile ? DrawerDescription : DialogDescription
    const Footer = mobile ? DrawerFooter : DialogFooter

    return (
      <>
        <Header className="relative shrink-0 gap-2 border-b px-5 py-5 pr-14 text-left! sm:px-6 sm:pr-14">
          <Title className="text-lg font-semibold">{item.name}</Title>
          <Description>预览完整排版，选择示例后开始填写。</Description>
          {mobile && (
            <Button aria-label="关闭预览" variant="ghost" size="icon-sm" onClick={() => setPreviewOpen(false)} className="absolute top-4 right-4 motion-reduce:transform-none" style={transitionStyle}>
              <X aria-hidden className="size-4" />
            </Button>
          )}
        </Header>
        {mobile && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3">
            <span className="text-xs text-muted-foreground">示例内容</span>
            <Select
              value={selectedExample.exampleId}
              onValueChange={(id) => {
                const ref = item.examples.find(example => example.exampleId === id)
                if (ref)
                  selectExample(item.templateId, ref)
              }}
              disabled={creation.loading}
            >
              <SelectTrigger aria-label="示例内容" className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{item.examples.map(example => <SelectItem key={example.exampleId} value={example.exampleId}>{example.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <div className="flex min-h-0 flex-1">
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-muted/50 p-4 sm:p-7">
            <AnimatedContent animationKey={exampleKey(selectedExample)} className="mx-auto max-w-2xl">
              <ExamplePreview item={item} example={selectedExample} />
            </AnimatedContent>
          </div>
          {!mobile && (
            <aside aria-label="模板详情" className="flex w-80 shrink-0 flex-col gap-6 overflow-y-auto border-l p-6">
              <div className="space-y-3">
                {category && (
                  <p className="text-xs text-muted-foreground">
                    {category.style}
                    风格 ·
                    {' '}
                    {category.layout}
                    排版
                  </p>
                )}
                <p className="text-sm leading-6">{item.description}</p>
              </div>
              <ExamplePicker item={item} disabled={creation.loading} />
              <p className="mt-auto border-t pt-4 text-xs leading-6 text-muted-foreground">创建后会带入所选示例，你可以在编辑器中逐项替换内容、调整模块并导出简历。</p>
            </aside>
          )}
        </div>
        {creation.error && <p role="alert" className="shrink-0 px-5 pt-3 text-sm text-destructive">{creation.error}</p>}
        <Footer className="m-0 shrink-0 flex-row items-center border-t px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          <p className="mr-auto hidden text-xs text-muted-foreground sm:block">
            当前示例：
            {item.examples.find(example => exampleKey(example) === exampleKey(selectedExample))?.name ?? selectedExample.exampleId}
          </p>
          <Button variant="outline" className="h-10 motion-reduce:transform-none" style={transitionStyle} onClick={() => setPreviewOpen(false)}>返回列表</Button>
          <Button
            className="h-10 flex-1 px-4 motion-reduce:transform-none sm:flex-none"
            style={transitionStyle}
            disabled={creation.disabled || !creation.isExampleReady(selectedExample)}
            onClick={() => {
              creation.create(selectedExample).then((ok) => {
                if (ok)
                  setPreviewOpen(false)
              })
            }}
          >
            {creation.loading ? '创建中…' : creation.retrying ? '重试创建' : '使用此模板'}
            <ArrowRight aria-hidden className="size-4" />
          </Button>
        </Footer>
      </>
    )
  }

  // 两个 Root 都保持挂载，跨越移动端断点时也从关闭状态进入各自的动画。
  return (
    <>
      <Drawer open={isMobile && previewOpen} onOpenChange={setPreviewOpen} showSwipeHandle>
        <DrawerContent
          className={cn('overflow-hidden rounded-t-2xl rounded-b-none duration-(--ui-motion-slow) [--drawer-inset:0px] data-[swipe-axis=y]:[--drawer-content-height:92dvh] data-[swipe-axis=y]:[--drawer-content-max-height:92dvh] data-ending-style:duration-(--ui-motion-fast)', reduceMotion && 'transition-none!')}
          overlayClassName={cn('duration-(--ui-motion-slow) data-ending-style:duration-(--ui-motion-fast)', reduceMotion && 'transition-none!')}
          finalFocus={() => isMobile && previewTrigger?.isConnected ? previewTrigger : false}
        >
          {renderContent(true)}
        </DrawerContent>
      </Drawer>
      <Dialog open={!isMobile && previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent
          className="flex h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl"
          style={reduceMotion ? { animationDuration: '0s' } : undefined}
          overlayClassName={reduceMotion ? 'animate-none!' : undefined}
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
          {renderContent(false)}
        </DialogContent>
      </Dialog>
    </>
  )
}
