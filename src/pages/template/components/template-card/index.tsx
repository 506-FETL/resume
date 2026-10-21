import type { TemplateCatalogItem } from '@/lib/resume-template/source/types'
import { Button } from '@/components/ui/button'
import { useTemplateCreation } from '../../hooks/use-template-creation'
import { useTemplatePageStore } from '../../store.ts'
import ExamplePreview from '../example-preview'

export default function TemplateCard({ item }: { item: TemplateCatalogItem }) {
  const showPreview = useTemplatePageStore(state => state.showPreview)
  const creation = useTemplateCreation(item)
  return (
    <article className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="relative aspect-[210/270] overflow-hidden border-b bg-muted/30 p-3" aria-label={`${item.name}示例`}>
        <ExamplePreview item={item} example={item.defaultExample} />
      </div>
      <div className="space-y-3 p-5">
        <h2 className="font-semibold">{item.name}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
        <div className="flex gap-2">
          <Button
            data-template-preview-trigger={item.templateId}
            variant="outline"
            onClick={() => {
              showPreview(item.templateId, item.defaultExample)
            }}
          >
            预览模板
          </Button>
          <Button disabled={creation.disabled || !creation.isExampleReady(item.defaultExample)} onClick={() => { creation.create(item.defaultExample) }}>{creation.loading ? '创建中…' : creation.retrying ? '重试创建' : '使用模板'}</Button>
        </div>
        {creation.error && <p role="alert" className="text-sm text-destructive">{creation.error}</p>}
      </div>
    </article>
  )
}
