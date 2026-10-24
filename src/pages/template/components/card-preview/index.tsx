import type {
  ExampleRef,
  TemplateCatalogItem,
} from '@/lib/resume-template/source/types'
import { FileText, LoaderCircle } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import AnimatedContent from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import { exampleKey } from '@/lib/resume-template/source/types'
import { cn } from '@/lib/utils'
import { TEMPLATE_PREVIEW_ROOT_MARGIN } from '../../const'
import { useTemplateIntersection } from '../../hooks/use-template-intersection'
import { useTemplatePreview } from '../../hooks/use-template-preview'

export default function CardPreview({
  item,
  example,
}: {
  item: TemplateCatalogItem
  example: ExampleRef
}) {
  const { ref, inRange } = useTemplateIntersection(
    TEMPLATE_PREVIEW_ROOT_MARGIN,
    true,
  )
  const reduceMotion = useReducedMotion()
  const preview = item.previews.find(
    (candidate) =>
      candidate.templateId === item.templateId &&
      candidate.templateVersion === item.currentVersion &&
      candidate.example.exampleId === example.exampleId &&
      candidate.example.version === example.version,
  )
  const { url, status, retry } = useTemplatePreview(preview, inRange)
  return (
    <div
      ref={ref}
      className={cn(
        'aspect-[210/297]',
        status === 'error' && 'pointer-events-none relative z-10',
      )}
      aria-label={`${item.name}首页预览`}
      data-preview-status={status}
    >
      <AnimatedContent animationKey={exampleKey(example)}>
        {url ? (
          <img
            src={url}
            alt={`${item.name}首页静态预览`}
            width={preview?.asset.width}
            height={preview?.asset.height}
            className='aspect-[210/297] w-full object-cover object-top'
          />
        ) : (
          <div className='flex aspect-[210/297] flex-col items-center justify-center gap-3 bg-muted/20 px-5 text-center'>
            {status === 'loading' ? (
              <LoaderCircle
                aria-hidden
                className={cn(
                  'size-6 text-muted-foreground/50',
                  !reduceMotion && 'animate-spin',
                )}
              />
            ) : (
              <FileText
                aria-hidden
                className='size-8 text-muted-foreground/50'
              />
            )}
            <p className='text-sm font-medium'>{item.name}</p>
            <p
              role={status === 'loading' ? 'status' : undefined}
              className='text-xs text-muted-foreground'
            >
              {status === 'loading'
                ? '正在加载缩略图…'
                : status === 'error'
                  ? '缩略图暂不可用，可重试或打开完整预览'
                  : '点击查看完整预览'}
            </p>
            {status === 'error' && (
              <Button
                variant='outline'
                size='sm'
                className='pointer-events-auto'
                onClick={retry}
              >
                重试缩略图
              </Button>
            )}
          </div>
        )}
      </AnimatedContent>
    </div>
  )
}
