import type { RefObject, ComponentType, ComponentProps } from 'react'
import type {
  TemplateCatalogItem,
  TemplateCardSummary,
} from '@/lib/resume-template/source/types'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DURATION } from '@/lib/motion'
import { exampleKey } from '@/lib/resume-template/source/types'
import { useTemplateCreation } from '../../hooks/use-template-creation'
import { useTemplatePageStore } from '../../store'
import TemplateCreationForm from '../creation-form'
import PreviewWorkspace from '../preview-workspace'

export default function PreviewContent({
  item,
  entry,
  mobile,
  Footer,
  titleRef,
}: {
  item: TemplateCardSummary
  entry?: TemplateCatalogItem
  mobile: boolean
  Footer: ComponentType<ComponentProps<'div'>>
  titleRef: RefObject<HTMLHeadingElement | null>
}) {
  const previewStep = useTemplatePageStore((state) => state.previewStep)

  const selection = useTemplatePageStore(
    (state) => state.selectedExamples[item.templateId],
  )

  const { selectExample, setPreviewStep, setPreviewOpen } =
    useTemplatePageStore.getState()

  const creation = useTemplateCreation(item)

  const selectedExample =
    creation.operation?.example ?? selection?.example ?? item.defaultExample

  const details = previewStep === 'details'
  const currentFormId = useId()
  const [form, setForm] = useState<HTMLFormElement | null>(null)
  const formReady = Boolean(form)
  const previousStepRef = useRef(previewStep)
  const useTemplateRef = useRef<HTMLButtonElement>(null)
  const reduceMotion = useReducedMotion()

  const transitionStyle = {
    transitionDuration: reduceMotion ? '0s' : `${DURATION.base}s`,
  }

  useLayoutEffect(() => {
    if (previousStepRef.current === previewStep) return

    previousStepRef.current = previewStep

    if (details) titleRef.current?.focus({ preventScroll: true })
    else useTemplateRef.current?.focus({ preventScroll: true })
  }, [details, previewStep, titleRef])

  return (
    <>
      {mobile && !details && (
        <div className='flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3'>
          <span className='text-xs text-muted-foreground'>示例内容</span>
          {entry ? (
            <Select
              value={selectedExample.exampleId}
              onValueChange={(id) => {
                const ref = entry.examples.find(
                  (example) => example.exampleId === id,
                )

                if (ref) selectExample(entry, ref)
              }}
              disabled={creation.locked}
            >
              <SelectTrigger aria-label='示例内容' className='w-44'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {entry.examples.map((example) => (
                  <SelectItem key={example.exampleId} value={example.exampleId}>
                    {example.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Skeleton className='h-9 w-44' />
          )}
        </div>
      )}
      <PreviewWorkspace
        item={item}
        entry={entry}
        example={selectedExample}
        mobile={mobile}
        disabled={creation.locked}
      >
        {details && (
          <TemplateCreationForm
            formId={currentFormId}
            formRef={setForm}
            creation={creation}
            onCreate={() => creation.create(selectedExample)}
          />
        )}
      </PreviewWorkspace>
      {creation.error && (
        <p role='alert' className='shrink-0 px-5 pt-3 text-sm text-destructive'>
          {creation.error}
        </p>
      )}
      {creation.operation && !creation.loading && !creation.error && (
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
                entry?.examples.find(
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
          ref={useTemplateRef}
          type={details ? 'submit' : 'button'}
          form={details ? currentFormId : undefined}
          className='h-10 flex-1 px-4 motion-reduce:transform-none sm:flex-none'
          style={transitionStyle}
          disabled={
            !entry ||
            (details && (!formReady || !creation.ready)) ||
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
            ? creation.operation && !creation.loading
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
