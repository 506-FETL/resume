import { PaperSkeleton } from '@/components/loading-skeleton'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import { resumeTemplateSource } from '@/lib/resume-template/source'
import type { TemplateCatalogItem } from '@/lib/resume-template/source/types'
import { cn } from '@/lib/utils'
import CatalogSkeleton from '@/pages/template/components/catalog-skeleton'
import { FileText } from 'lucide-react'
import { LayoutGroup, motion, useAnimationControls } from 'motion/react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useCreationDraftStore } from '../../../store'
import { mergeTemplateOptions } from '../../../utils'
import ResumeDetails from '../../resume-details'
import { TemplateOption } from '../template-option/index'

export function TemplatePicker({
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
          {loading && items.length === 0 && (
            <CatalogSkeleton className='grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4' />
          )}
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
            {nextOffset !== null && (!loading || items.length > 0) && (
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
                    <PaperSkeleton
                      label='正在读取已选模板'
                      className='h-full'
                    />
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
