import type { TemplateCatalogItem } from '@/lib/resume-template/source/types'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useId, useLayoutEffect, useRef } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import AnimatedContent from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useIsMobile } from '@/hooks/use-mobile'
import { DURATION } from '@/lib/motion'
import { exampleKey } from '@/lib/resume-template/source/types'
import { cn } from '@/lib/utils'
import { useResumeTemplateStore } from '@/store/resume-template'
import { useTemplateCreation } from '../../hooks/use-template-creation'
import { useTemplatePageStore } from '../../store.ts'
import TemplateCreationForm from '../creation-form'
import PreviewWorkspace from '../preview-workspace'

function PreviewDialog({ item }: { item: TemplateCatalogItem }) {
  const {
    previewOpen,
    setPreviewOpen,
    previewTrigger,
    selectedExamples,
    selectExample,
    previewStep,
    setPreviewStep,
  } = useTemplatePageStore()

  const creation = useTemplateCreation(item)

  const selectedExample =
    creation.draft.operation?.example ??
    selectedExamples[item.templateId] ??
    item.defaultExample

  const details = previewStep === 'details'
  const formId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const mobileTitleRef = useRef<HTMLHeadingElement>(null)
  const useTemplateRef = useRef<HTMLButtonElement>(null)
  const mobileUseTemplateRef = useRef<HTMLButtonElement>(null)
  const previousStepRef = useRef(previewStep)
  const isMobile = useIsMobile()
  const reduceMotion = useReducedMotion()

  const transitionStyle = {
    transitionDuration: reduceMotion ? '0s' : `${DURATION.base}s`,
  }

  useLayoutEffect(() => {
    const changed = previousStepRef.current !== previewStep

    previousStepRef.current = previewStep

    if (!previewOpen || !changed) return

    const title = isMobile ? mobileTitleRef.current : titleRef.current

    const trigger = isMobile
      ? mobileUseTemplateRef.current
      : useTemplateRef.current

    if (details) title?.focus({ preventScroll: true })
    else trigger?.focus({ preventScroll: true })
  }, [details, previewOpen, previewStep, isMobile])

  function renderContent(mobile: boolean) {
    const Header = mobile ? DrawerHeader : DialogHeader
    const Title = mobile ? DrawerTitle : DialogTitle
    const Description = mobile ? DrawerDescription : DialogDescription
    const Footer = mobile ? DrawerFooter : DialogFooter
    const currentFormId = `${formId}-${mobile ? 'mobile' : 'desktop'}`

    return (
      <>
        <Header className='relative shrink-0 gap-2 border-b px-5 py-5 pr-14 text-left! sm:px-6 sm:pr-14'>
          <Title
            ref={mobile ? mobileTitleRef : titleRef}
            tabIndex={-1}
            className='text-lg font-semibold outline-none'
          >
            <AnimatedContent animationKey={previewStep} as='span'>
              {details ? '填写简历信息' : item.name}
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
              style={transitionStyle}
            >
              <X aria-hidden className='size-4' />
            </Button>
          )}
        </Header>
        {mobile && !details && (
          <div className='flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3'>
            <span className='text-xs text-muted-foreground'>示例内容</span>
            <Select
              value={selectedExample.exampleId}
              onValueChange={(id) => {
                const ref = item.examples.find(
                  (example) => example.exampleId === id,
                )

                if (ref) selectExample(item.templateId, ref)
              }}
              disabled={creation.locked || !creation.ready}
            >
              <SelectTrigger aria-label='示例内容' className='w-44'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {item.examples.map((example) => (
                  <SelectItem key={example.exampleId} value={example.exampleId}>
                    {example.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <PreviewWorkspace
          item={item}
          example={selectedExample}
          mobile={mobile}
          disabled={creation.locked || !creation.ready}
        >
          <TemplateCreationForm
            formId={currentFormId}
            creation={creation}
            onCreate={() => creation.create(selectedExample)}
          />
        </PreviewWorkspace>
        {creation.error && (
          <p
            role='alert'
            className='shrink-0 px-5 pt-3 text-sm text-destructive'
          >
            {creation.error}
          </p>
        )}
        {creation.draft.operation && !creation.loading && !creation.error && (
          <p
            role='status'
            className='shrink-0 px-5 pt-3 text-xs text-muted-foreground'
          >
            这次创建还没有确认完成，重试会继续确认原来的简历。
          </p>
        )}
        <Footer className='m-0 shrink-0 flex-row items-center border-t px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6'>
          <p className='mr-auto hidden text-xs text-muted-foreground sm:block'>
            {details
              ? `${item.name} · ${creation.mode === 'cloud' ? '云端' : '本地'}`
              : `当前示例：${
                  item.examples.find(
                    (example) =>
                      exampleKey(example) === exampleKey(selectedExample),
                  )?.name ?? selectedExample.exampleId
                }`}
          </p>
          <Button
            variant='outline'
            className='h-10 motion-reduce:transform-none'
            style={transitionStyle}
            onClick={() =>
              details ? setPreviewStep('preview') : setPreviewOpen(false)
            }
          >
            {details && <ArrowLeft aria-hidden className='size-4' />}
            {details ? '返回预览' : '返回列表'}
          </Button>
          <Button
            ref={mobile ? mobileUseTemplateRef : useTemplateRef}
            type={details ? 'submit' : 'button'}
            form={details ? currentFormId : undefined}
            className='h-10 flex-1 px-4 motion-reduce:transform-none sm:flex-none'
            style={transitionStyle}
            disabled={
              !creation.ready ||
              creation.loading ||
              !creation.isExampleReady(selectedExample)
            }
            onClick={
              details
                ? undefined
                : (event) => {
                    // 切步后该按钮会变成 submit，不能让本次点击继续提交新表单。
                    event.preventDefault()
                    setPreviewStep('details')
                  }
            }
          >
            {details
              ? creation.draft.operation && !creation.loading
                ? '确认创建结果'
                : '创建简历'
              : '使用此模板'}
            {creation.loading ? (
              <Spinner aria-label='正在创建简历' />
            ) : (
              !details && <ArrowRight aria-hidden className='size-4' />
            )}
          </Button>
        </Footer>
      </>
    )
  }

  // 两个 Root 都保持挂载，跨越移动端断点时也从关闭状态进入各自的动画。
  return (
    <>
      <Drawer
        open={isMobile && previewOpen}
        onOpenChange={setPreviewOpen}
        showSwipeHandle
      >
        <DrawerContent
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
          {renderContent(true)}
        </DrawerContent>
      </Drawer>
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
          {renderContent(false)}
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function TemplatePreviewDialog() {
  const catalog = useResumeTemplateStore((state) => state.catalog)

  const selectedTemplateId = useTemplatePageStore(
    (state) => state.selectedTemplateId,
  )

  // 预览状态独立订阅，打开与切换示例不触发背景目录的布局测量。
  const item =
    catalog.status === 'ready'
      ? (catalog.data.find((item) => item.templateId === selectedTemplateId) ??
        catalog.data[0])
      : undefined

  return item ? <PreviewDialog item={item} /> : null
}
