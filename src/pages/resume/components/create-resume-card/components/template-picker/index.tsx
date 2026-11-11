import { Spinner } from '@/components/ui/spinner'
import type {
  ExampleRef,
  TemplateCatalogItem,
} from '@/lib/resume-template/source/types'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, FileText } from 'lucide-react'
import { LayoutGroup, motion, useAnimationControls } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { Button } from '@/components/ui/button'
import { DURATION, EASE } from '@/lib/motion'
import { resumeTemplateSource } from '@/lib/resume-template/source'
import { cn } from '@/lib/utils'
import { useTemplateIntersection } from '@/pages/template/hooks/use-template-intersection'
import { useTemplatePreview } from '@/pages/template/hooks/use-template-preview'
import { useCreationDraftStore } from '../../store'
import { mergeTemplateOptions } from '../../utils'
import ResumeDetails from '../resume-details'

export default function TemplatePicker({
  formId,
  busy,
  onCreate,
}: {
  formId: string
  busy: boolean
  onCreate: () => void
}) {
  const layoutId = useId()
  const reduceMotion = useReducedMotion()
  const detailsControls = useAnimationControls()
  const galleryRef = useRef<HTMLDivElement>(null)
  const detailsScrollRef = useRef<HTMLDivElement>(null)

  const [detailsTarget, setDetailsTarget] = useState<HTMLDivElement | null>(
    null,
  )

  const [items, setItems] = useState<TemplateCatalogItem[]>([])
  const [nextOffset, setNextOffset] = useState<number | null>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [entryAttempt, setEntryAttempt] = useState(0)

  const [entryState, setEntryState] = useState<{
    key: string
    status: 'loading' | 'error' | 'missing'
  } | null>(null)

  const aliveRef = useRef(false)
  const pendingRef = useRef(false)

  const selected = useCreationDraftStore(
    (state) => state.draft.creation?.selection ?? state.draft.selectedTemplate,
  )

  const details = useCreationDraftStore((state) => state.step === 'details')
  const previousDetailsRef = useRef(details)
  const returnFocusPendingRef = useRef(false)
  const locked = useCreationDraftStore((state) => Boolean(state.draft.creation))
  const patch = useCreationDraftStore((state) => state.patch)
  const selectedId = selected?.template.templateId
  const selectedVersion = selected?.template.templateVersion
  const selectedKey = `${selectedId}@${selectedVersion}`

  const selectedItem = items.find(
    (item) =>
      item.templateId === selectedId && item.currentVersion === selectedVersion,
  )

  const entryStatus = !selected
    ? 'missing'
    : entryState?.key === selectedKey
      ? entryState.status
      : 'loading'

  useLayoutEffect(() => {
    if (!details && detailsScrollRef.current)
      detailsScrollRef.current.scrollTop = 0
  }, [details])

  useEffect(() => {
    const target = {
      opacity: details ? 1 : 0,
      transform: `translateY(${details || reduceMotion ? 0 : 8}px)`,
    }

    if (reduceMotion) detailsControls.set(target)
    else
      detailsControls.start({
        ...target,
        transition: {
          duration: details ? DURATION.base : DURATION.fast,
          delay: details ? DURATION.fast : 0,
          ease: EASE.out,
        },
      })

    return () => detailsControls.stop()
  }, [details, reduceMotion, detailsControls])

  async function load(offset: number) {
    if (pendingRef.current) return

    pendingRef.current = true
    setLoading(true)
    setError(null)

    try {
      const page = await resumeTemplateSource.listTemplatePage({ offset })

      if (!aliveRef.current) return

      const draft = useCreationDraftStore.getState().draft

      setItems((current) =>
        mergeTemplateOptions(
          current,
          page.items,
          draft.creation?.selection ?? draft.selectedTemplate,
        ),
      )

      setNextOffset(page.nextOffset)
    } catch {
      if (aliveRef.current) setError('模板加载失败，请重试')
    } finally {
      pendingRef.current = false

      if (aliveRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    aliveRef.current = true
    load(0)

    return () => {
      aliveRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!selectedId || selectedItem) return

    let active = true

    setEntryState({ key: selectedKey, status: 'loading' })

    resumeTemplateSource
      .getTemplateCatalogEntry(selectedId, { force: entryAttempt > 0 })
      .then((entry) => {
        if (!active) return

        if (!entry || entry.item.currentVersion !== selectedVersion) {
          setEntryState({ key: selectedKey, status: 'missing' })

          return
        }

        const draft = useCreationDraftStore.getState().draft

        setItems((current) =>
          mergeTemplateOptions(
            current,
            [entry.item],
            draft.creation?.selection ?? draft.selectedTemplate,
          ),
        )
      })
      .catch(() => {
        if (active) setEntryState({ key: selectedKey, status: 'error' })
      })

    return () => {
      active = false
    }
  }, [selectedId, selectedVersion, selectedKey, selectedItem, entryAttempt])

  useLayoutEffect(() => {
    const returning = previousDetailsRef.current && !details

    previousDetailsRef.current = details

    if (details) returnFocusPendingRef.current = false
    if (returning) returnFocusPendingRef.current = true
    if (!selectedItem || (!details && !returnFocusPendingRef.current)) return

    const gallery = galleryRef.current

    const slot = gallery?.querySelector<HTMLElement>(
      '[data-template-slot-selected=true]',
    )

    if (!gallery || !slot) return

    const galleryRect = gallery.getBoundingClientRect()
    const slotRect = slot.getBoundingClientRect()

    // 提前对齐隐藏目录，避免返回投影开始后再滚动造成纸张跳出视口。
    if (slotRect.top < galleryRect.top || slotRect.bottom > galleryRect.bottom)
      gallery.scrollTo({
        top:
          gallery.scrollTop +
          slotRect.top -
          galleryRect.top -
          (gallery.clientHeight - slot.clientHeight) / 2,
        behavior: 'instant',
      })

    if (details) return

    const button = slot.querySelector<HTMLButtonElement>(
      '[data-template-selected=true]',
    )

    if (button) {
      button.focus({ preventScroll: true })
      returnFocusPendingRef.current = false
    }
  }, [details, selectedItem])

  return (
    <LayoutGroup id={layoutId}>
      <div className='relative h-full min-h-0' data-template-workspace>
        <motion.div
          ref={galleryRef}
          layoutScroll
          data-template-gallery
          inert={details}
          aria-hidden={details}
          className='absolute inset-0 space-y-4 overflow-y-auto overscroll-y-contain p-1'
        >
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'>
            {items.map((item, index) => (
              <TemplateOption
                key={item.templateId}
                item={item}
                index={index}
                detailsTarget={details ? detailsTarget : null}
                example={
                  selectedId === item.templateId &&
                  selectedVersion === item.currentVersion
                    ? (selected?.example ?? item.defaultExample)
                    : item.defaultExample
                }
                selected={
                  selected?.template.templateId === item.templateId &&
                  selected.template.templateVersion === item.currentVersion
                }
                disabled={locked}
                onSelect={() => {
                  if (
                    selectedId === item.templateId &&
                    selectedVersion === item.currentVersion
                  )
                    return

                  patch({
                    selectedTemplate: {
                      template: {
                        templateId: item.templateId,
                        templateVersion: item.currentVersion,
                      },
                      example: item.defaultExample,
                      name: item.name,
                    },
                  })
                }}
              />
            ))}
          </div>
          <div
            className='flex min-h-9 items-center justify-center gap-3 transition-opacity'
            style={{
              opacity: details ? 0 : 1,
              transitionDuration: `${reduceMotion ? 0 : DURATION.fast}s`,
              transitionDelay: `${reduceMotion || details ? 0 : DURATION.fast}s`,
            }}
          >
            {error && (
              <p role='alert' className='text-sm text-destructive'>
                {error}
              </p>
            )}
            {nextOffset !== null && (
              <Button
                variant='outline'
                size='sm'
                disabled={loading}
                onClick={() => load(nextOffset)}
              >
                {loading && <Spinner aria-label='正在加载更多模板' />}
                {error ? '重试' : '更多模板'}
              </Button>
            )}
            {!loading && !error && items.length === 0 && (
              <p className='text-sm text-muted-foreground'>暂无可用模板</p>
            )}
          </div>
        </motion.div>
        <motion.div
          ref={detailsScrollRef}
          layoutScroll
          data-template-details
          inert={!details}
          aria-hidden={!details}
          className={cn(
            'absolute inset-y-0 -inset-x-5 overflow-y-auto overscroll-y-contain',
            !details && 'pointer-events-none',
          )}
        >
          <div className='relative min-h-full sm:grid sm:grid-cols-[56%_44%]'>
            <div
              ref={setDetailsTarget}
              data-template-selected-preview
              className='relative h-[clamp(20rem,44svh,24rem)] w-full sm:absolute sm:inset-y-0 sm:left-0 sm:h-full sm:w-[58%]'
            >
              {details && !selectedItem && (
                <div
                  data-template-entry-status={entryStatus}
                  className='flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-muted-foreground'
                >
                  {entryStatus === 'loading' ? (
                    <Spinner className='size-6' aria-label='正在读取已选模板' />
                  ) : (
                    <FileText aria-hidden className='size-8' />
                  )}
                  {entryStatus !== 'loading' && (
                    <p
                      className='text-sm'
                      role={entryStatus === 'error' ? 'alert' : 'status'}
                    >
                      {entryStatus === 'error'
                        ? '已选模板加载失败'
                        : '找不到所选版本的预览。'}
                    </p>
                  )}
                  {entryStatus === 'error' && (
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setEntryAttempt((attempt) => attempt + 1)}
                    >
                      重试加载模板
                    </Button>
                  )}
                </div>
              )}
            </div>
            <motion.div
              data-template-details-form
              className='relative z-10 -mt-6 px-5 pb-5 sm:col-start-2 sm:my-auto sm:py-10 sm:pr-8 sm:pl-2'
              initial={{
                opacity: 0,
                transform: `translateY(${reduceMotion ? 0 : 8}px)`,
              }}
              animate={detailsControls}
            >
              <ResumeDetails formId={formId} busy={busy} onSubmit={onCreate} />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </LayoutGroup>
  )
}

function TemplateOption({
  item,
  index,
  selected,
  disabled,
  onSelect,
  detailsTarget,
  example,
}: {
  item: TemplateCatalogItem
  index: number
  selected: boolean
  disabled: boolean
  onSelect: () => void
  detailsTarget: HTMLDivElement | null
  example: ExampleRef
}) {
  const reduceMotion = useReducedMotion()
  const controls = useAnimationControls()
  const { ref, inRange } = useTemplateIntersection('120px', true)

  const preview = item.previews.find(
    (candidate) =>
      candidate.example.exampleId === example.exampleId &&
      candidate.example.version === example.version &&
      candidate.templateVersion === item.currentVersion,
  )

  const inDetails = selected && detailsTarget !== null

  const { url, status, retry } = useTemplatePreview(
    preview,
    inRange || inDetails,
  )

  const thumbnail = url ? (
    <img
      src={url}
      alt={`${item.name}排版预览`}
      width={preview?.asset.width}
      height={preview?.asset.height}
      className={cn(
        'h-full w-full',
        inDetails ? 'object-cover object-top' : 'object-contain',
      )}
    />
  ) : (
    <div
      data-template-preview-status={status}
      className='flex h-full flex-col items-center justify-center gap-2 text-muted-foreground'
    >
      {status === 'loading' ? (
        <Spinner className='size-5' aria-label='正在加载模板预览' />
      ) : (
        <FileText className='size-6' />
      )}
      {status !== 'loading' && (
        <span className='text-xs'>
          {status === 'error'
            ? '预览加载失败'
            : status === 'missing'
              ? '此示例暂未提供预览'
              : '模板预览'}
        </span>
      )}
      {status === 'error' && inDetails && (
        <Button variant='outline' size='sm' onClick={retry}>
          重试加载预览
        </Button>
      )}
    </div>
  )

  useEffect(() => {
    const target = {
      opacity: detailsTarget && !selected ? 0 : 1,
      transform: 'translateY(0px)',
    }

    if (reduceMotion) controls.set(target)
    else
      controls.start({
        ...target,
        transition: {
          duration: DURATION.fast,
          ease: EASE.out,
          delay: detailsTarget || selected ? 0 : (index % 12) * 0.02,
        },
      })

    return () => controls.stop()
  }, [controls, detailsTarget, selected, index, reduceMotion])

  // 降级时重建投影节点以结束在途位移；跨容器始终按视口投影，避免滚动偏移被缩放。
  const card = (
    <motion.div
      key={reduceMotion ? 'reduced' : 'motion'}
      layoutId={`${item.templateId}@${item.currentVersion}`}
      data-framer-portal-id={item.templateId}
      data-template-motion-card
      data-template-active={selected}
      data-template-background={inDetails || undefined}
      layout
      className={cn(
        'min-w-0',
        inDetails && 'h-full w-full overflow-hidden',
        inDetails &&
          url &&
          '[mask-image:linear-gradient(to_bottom,#000_40%,#0009_68%,transparent_100%)] sm:[mask-image:linear-gradient(to_right,#000_20%,transparent_100%)] dark:opacity-60',
      )}
      initial={false}
      transition={{
        duration: reduceMotion ? 0 : DURATION.slow,
        ease: EASE.out,
      }}
    >
      {inDetails ? (
        thumbnail
      ) : (
        <Button
          variant='outline'
          type='button'
          aria-label={`选择${item.name}`}
          aria-pressed={selected}
          data-template-selected={selected}
          disabled={disabled}
          onClick={onSelect}
          className={cn(
            'group relative block h-auto w-full overflow-hidden rounded-lg bg-background p-0 text-left whitespace-normal shadow-none transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-4 focus-visible:outline-ring focus-visible:ring-0 active:translate-y-0 disabled:cursor-default disabled:opacity-100',
            selected ? 'border-primary' : 'hover:border-foreground/40',
          )}
          style={{ transitionDuration: `${reduceMotion ? 0 : DURATION.base}s` }}
        >
          <span
            aria-hidden
            data-template-selection
            className={cn(
              'pointer-events-none absolute inset-0 z-10 rounded-[inherit] border-2 border-primary transition-opacity',
              selected ? 'opacity-100' : 'opacity-0',
            )}
            style={{
              transitionDuration: `${reduceMotion ? 0 : DURATION.base}s`,
            }}
          />
          <div className='relative aspect-[210/297] overflow-hidden bg-muted/30'>
            {thumbnail}
            <span
              aria-hidden
              className={cn(
                'absolute top-2 right-2 rounded-full bg-primary p-1 text-primary-foreground transition-[opacity,scale]',
                selected ? 'scale-100 opacity-100' : 'scale-90 opacity-0',
              )}
              style={{
                transitionDuration: `${reduceMotion ? 0 : DURATION.fast}s`,
              }}
            >
              <Check className='size-3' />
            </span>
          </div>
          <span
            title={item.name}
            className='block truncate border-t px-2.5 py-2 text-xs font-medium'
          >
            {item.name}
          </span>
        </Button>
      )}
    </motion.div>
  )

  return (
    <motion.div
      ref={ref}
      data-template-slot-selected={selected}
      className='min-w-0'
      initial={{
        opacity: reduceMotion ? 1 : 0,
        transform: `translateY(${reduceMotion ? 0 : 8}px)`,
      }}
      animate={controls}
    >
      {inDetails ? (
        <>
          <div aria-hidden className='border border-transparent'>
            <div className='aspect-[210/297]' />
            <div className='h-[2.0625rem]' />
          </div>
          {createPortal(card, detailsTarget)}
        </>
      ) : (
        card
      )}
    </motion.div>
  )
}
