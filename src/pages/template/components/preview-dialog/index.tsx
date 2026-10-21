import type { TemplateCatalogItem } from '@/lib/resume-template/source/types'
import { useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EXAMPLE_LABELS } from '../../const'
import { useTemplateCreation } from '../../hooks/use-template-creation'
import { useTemplatePageStore } from '../../store.ts'
import ExamplePreview from '../example-preview'

export default function PreviewDialog({ item }: { item: TemplateCatalogItem }) {
  const { previewOpen, setPreviewOpen, selectedExample, selectExample } = useTemplatePageStore()
  const creation = useTemplateCreation(item)
  const reduceMotion = useReducedMotion()
  return (
    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
      <DialogContent
        className="flex max-h-[90dvh] flex-col sm:max-w-3xl"
        style={reduceMotion ? { animationDuration: '0s' } : undefined}
        overlayClassName={reduceMotion ? 'animate-none!' : undefined}
        onCloseAutoFocus={(event) => {
          const trigger = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-template-preview-trigger]'))
            .find(button => button.dataset.templatePreviewTrigger === item.templateId)
          if (trigger) {
            event.preventDefault()
            trigger.focus()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription>选择示例查看排版。使用后会创建一份新简历，你可以逐项替换内容。</DialogDescription>
        </DialogHeader>
        <Select
          value={selectedExample.exampleId}
          onValueChange={(id) => {
            const ref = item.examples.find(example => example.exampleId === id)
            if (ref)
              selectExample(ref)
          }}
          disabled={creation.loading}
        >
          <SelectTrigger aria-label="示例内容"><SelectValue /></SelectTrigger>
          <SelectContent>{item.examples.map(example => <SelectItem key={example.exampleId} value={example.exampleId}>{EXAMPLE_LABELS[example.exampleId] ?? example.exampleId}</SelectItem>)}</SelectContent>
        </Select>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-md bg-muted/30 p-3"><ExamplePreview item={item} example={selectedExample} /></div>
        {creation.error && <p role="alert" className="text-sm text-destructive">{creation.error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setPreviewOpen(false)}>关闭</Button>
          <Button
            disabled={creation.disabled || !creation.isExampleReady(selectedExample)}
            onClick={() => {
              creation.create(selectedExample).then((ok) => {
                if (ok)
                  setPreviewOpen(false)
              })
            }}
          >
            {creation.loading ? '创建中…' : creation.retrying ? '重试创建' : '使用此模板'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
