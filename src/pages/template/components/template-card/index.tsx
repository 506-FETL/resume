import type { TemplateCatalogItem } from '@/lib/resume-template/source/types'
import { ArrowRight } from 'lucide-react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION } from '@/lib/motion'
import { useTemplatePrefetch } from '../../hooks/use-template-prefetch'
import { useTemplatePageStore } from '../../store.ts'
import CardPreview from '../card-preview'

export default function TemplateCard({ item }: { item: TemplateCatalogItem }) {
  const showPreview = useTemplatePageStore((state) => state.showPreview)

  const selectedExample =
    useTemplatePageStore((state) => state.selectedExamples[item.templateId]) ??
    item.defaultExample

  const prefetchEvents = useTemplatePrefetch(item, selectedExample)
  const category = item.category
  const reduceMotion = useReducedMotion()

  const transitionStyle = {
    transitionDuration: reduceMotion ? '0s' : `${DURATION.base}s`,
  }

  return (
    <article
      className='group relative min-w-0 overflow-hidden rounded-lg bg-card text-card-foreground transition-colors ease-(--ui-motion-enter-ease) hover:bg-muted/40'
      style={transitionStyle}
    >
      <div className='relative aspect-[210/297] overflow-hidden rounded-lg border border-border/60 bg-muted/20'>
        <CardPreview item={item} example={selectedExample} />
        <div
          aria-hidden
          className='pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-background/95 p-4 opacity-0 backdrop-blur-sm transition-[opacity,translate] duration-(--ui-motion-fast) ease-(--ui-motion-exit-ease) group-hover:translate-y-0 group-hover:opacity-100 group-hover:duration-(--ui-motion-base) group-hover:ease-(--ui-motion-enter-ease) group-focus-within:translate-y-0 group-focus-within:opacity-100 group-focus-within:duration-(--ui-motion-base) group-focus-within:ease-(--ui-motion-enter-ease) motion-reduce:translate-none'
          style={reduceMotion ? { transitionDuration: '0s' } : undefined}
        >
          <p className='line-clamp-3 text-xs leading-5 text-muted-foreground'>
            {item.description}
          </p>
        </div>
      </div>
      <div className='flex min-w-0 items-center gap-3 px-1 py-3'>
        <div className='min-w-0 flex-1'>
          <h2 className='truncate text-sm font-semibold' title={item.name}>
            {item.name}
          </h2>
          <p className='mt-1 text-xs leading-5 text-muted-foreground'>
            {category ? `${category.style} · ${category.layout}` : '完整示例'}
          </p>
        </div>
        <span className='inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground'>
          预览
          <ArrowRight aria-hidden className='size-3.5' />
        </span>
      </div>
      <button
        type='button'
        aria-label={`预览${item.name}`}
        data-template-preview-trigger={item.templateId}
        {...prefetchEvents}
        onClick={(event) =>
          showPreview(item.templateId, selectedExample, event.currentTarget)
        }
        className='absolute inset-0 cursor-pointer rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
      />
    </article>
  )
}
