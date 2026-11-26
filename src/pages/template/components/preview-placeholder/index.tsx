import { PaperSkeleton } from '@/components/loading-skeleton'
import { useTemplatePreview } from '../../hooks/use-template-preview'
import { useTemplatePageStore } from '../../store'

export default function PreviewPlaceholder() {
  const target = useTemplatePageStore((state) => state.previewTarget)

  const selection = useTemplatePageStore(
    (state) => target && state.selectedExamples[target.templateId],
  )

  const preview = selection?.preview
  const { url } = useTemplatePreview(preview, Boolean(target))

  return (
    <div className='flex min-h-0 flex-1 overflow-hidden'>
      <div className='min-w-0 flex-1 overflow-hidden bg-muted/50 p-4 sm:p-7'>
        {url ? (
          <img
            src={url}
            alt={`${target?.name}首页预览`}
            width={preview?.asset.width}
            height={preview?.asset.height}
            className='mx-auto h-auto w-full max-w-2xl'
          />
        ) : (
          <PaperSkeleton
            className='mx-auto max-w-2xl'
            label='正在加载模板预览'
          />
        )}
      </div>
      <aside aria-hidden className='hidden w-80 shrink-0 border-l md:block' />
    </div>
  )
}
