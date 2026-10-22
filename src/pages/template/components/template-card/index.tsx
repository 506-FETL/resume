import type { TemplateCatalogItem } from '@/lib/resume-template/source/types'
import { ArrowRight, ScanSearch } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { DURATION } from '@/lib/motion'
import { useTemplatePageStore } from '../../store.ts'
import CardPreview from '../card-preview'

export default function TemplateCard({ item }: { item: TemplateCatalogItem }) {
  const showPreview = useTemplatePageStore(state => state.showPreview)
  const selectedExample = useTemplatePageStore(state => state.selectedExamples[item.templateId]) ?? item.defaultExample
  const category = item.category
  const reduceMotion = useReducedMotion()
  const transitionStyle = { transitionDuration: reduceMotion ? '0s' : `${DURATION.base}s` }

  return (
    <article className="group relative aspect-[210/297] min-w-0 overflow-hidden rounded-xl border bg-card text-card-foreground transition-[border-color,box-shadow] hover:border-foreground/20 hover:shadow-md" style={transitionStyle}>
      <CardPreview item={item} example={selectedExample} />
      <button
        type="button"
        aria-label={`预览${item.name}`}
        data-template-preview-trigger={item.templateId}
        onClick={event => showPreview(item.templateId, selectedExample, event.currentTarget)}
        className="group/preview absolute inset-0 cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span
          className="absolute inset-x-0 bottom-0 translate-y-2 space-y-3 border-t bg-background/95 p-4 opacity-0 backdrop-blur-sm transition-[opacity,translate] duration-(--ui-motion-fast) ease-(--ui-motion-exit-ease) group-hover/preview:translate-y-0 group-hover/preview:opacity-100 group-hover/preview:duration-(--ui-motion-base) group-hover/preview:ease-(--ui-motion-enter-ease) group-focus-visible/preview:translate-y-0 group-focus-visible/preview:opacity-100 group-focus-visible/preview:duration-(--ui-motion-base) group-focus-visible/preview:ease-(--ui-motion-enter-ease) motion-reduce:translate-none"
          style={reduceMotion ? { transitionDuration: '0s' } : undefined}
        >
          <span className="block truncate text-sm font-semibold">{item.name}</span>
          <span className="block text-xs leading-5 text-muted-foreground">{item.description}</span>
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{category ? `${category.style} · ${category.layout}` : '完整示例'}</span>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground">
              <ScanSearch aria-hidden className="size-3.5" />
              预览模板
              <ArrowRight aria-hidden className="size-3.5" />
            </span>
          </span>
        </span>
      </button>
    </article>
  )
}
