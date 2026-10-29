import type { TemplateCatalogItem } from '@/lib/resume-template/source/types'
import { useEffect, useRef, useState } from 'react'
import { Check, FileText, LoaderCircle } from 'lucide-react'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { Button } from '@/components/ui/button'
import { DURATION, EASE } from '@/lib/motion'
import { resumeTemplateSource } from '@/lib/resume-template/source'
import { cn } from '@/lib/utils'
import { useTemplateIntersection } from '@/pages/template/hooks/use-template-intersection'
import { useTemplatePreview } from '@/pages/template/hooks/use-template-preview'
import { useCreationDraftStore } from '../../store'

export default function TemplatePicker() {
  const [items, setItems] = useState<TemplateCatalogItem[]>([])
  const [nextOffset, setNextOffset] = useState<number | null>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const aliveRef = useRef(false)
  const pendingRef = useRef(false)

  const selected = useCreationDraftStore(
    (state) => state.draft.selectedTemplate,
  )

  const locked = useCreationDraftStore((state) => Boolean(state.draft.creation))
  const patch = useCreationDraftStore((state) => state.patch)

  async function load(offset: number) {
    if (pendingRef.current) return

    pendingRef.current = true
    setLoading(true)
    setError(null)

    try {
      const page = await resumeTemplateSource.listTemplatePage({ offset })

      if (!aliveRef.current) return

      setItems((current) => [
        ...new Map(
          [...current, ...page.items].map((item) => [item.templateId, item]),
        ).values(),
      ])

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

  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'>
        {items.map((item, index) => (
          <TemplateOption
            key={item.templateId}
            item={item}
            index={index}
            selected={
              selected?.template.templateId === item.templateId &&
              selected.template.templateVersion === item.currentVersion
            }
            disabled={locked}
            onSelect={() =>
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
            }
          />
        ))}
      </div>
      <div className='flex min-h-9 items-center justify-center gap-3'>
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
            {loading ? '加载中…' : error ? '重试' : '更多模板'}
          </Button>
        )}
        {!loading && !error && items.length === 0 && (
          <p className='text-sm text-muted-foreground'>暂无可用模板</p>
        )}
      </div>
    </div>
  )
}

function TemplateOption({
  item,
  index,
  selected,
  disabled,
  onSelect,
}: {
  item: TemplateCatalogItem
  index: number
  selected: boolean
  disabled: boolean
  onSelect: () => void
}) {
  const reduceMotion = useReducedMotion()
  const { ref, inRange } = useTemplateIntersection('120px', true)

  const preview = item.previews.find(
    (candidate) =>
      candidate.example.exampleId === item.defaultExample.exampleId &&
      candidate.example.version === item.defaultExample.version &&
      candidate.templateVersion === item.currentVersion,
  )

  const { url, status } = useTemplatePreview(preview, inRange)

  return (
    <motion.div
      ref={ref}
      className='min-w-0'
      initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0 : DURATION.base,
        ease: EASE.out,
        delay: reduceMotion ? 0 : (index % 12) * 0.02,
      }}
    >
      <Button
        variant='outline'
        type='button'
        aria-label={`选择${item.name}`}
        aria-pressed={selected}
        disabled={disabled}
        onClick={onSelect}
        className={cn(
          'group relative block h-auto w-full overflow-hidden rounded-lg bg-background p-0 text-left whitespace-normal shadow-none transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-4 focus-visible:outline-ring focus-visible:ring-0 active:translate-y-0 disabled:cursor-default',
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
          style={{ transitionDuration: `${reduceMotion ? 0 : DURATION.base}s` }}
        />
        <div className='relative aspect-[210/297] overflow-hidden bg-muted/30'>
          {url ? (
            <img
              src={url}
              alt={`${item.name}排版预览`}
              width={preview?.asset.width}
              height={preview?.asset.height}
              className='h-full w-full object-contain'
            />
          ) : (
            <div className='flex h-full flex-col items-center justify-center gap-2 text-muted-foreground'>
              {status === 'loading' ? (
                <LoaderCircle
                  className={cn('size-5', !reduceMotion && 'animate-spin')}
                />
              ) : (
                <FileText className='size-6' />
              )}
              <span className='text-xs'>
                {status === 'error' ? '预览暂不可用' : '模板预览'}
              </span>
            </div>
          )}
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
        <span className='block truncate border-t px-2.5 py-2 text-xs font-medium'>
          {item.name}
        </span>
      </Button>
    </motion.div>
  )
}
