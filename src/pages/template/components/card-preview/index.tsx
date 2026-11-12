import { PaperSkeleton } from '@/components/loading-skeleton'
import type {
  ExampleRef,
  TemplateCatalogItem,
} from '@/lib/resume-template/source/types'
import { FileText } from 'lucide-react'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
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
  const reduced = useReducedMotion()

  const { ref, inRange } = useTemplateIntersection(
    TEMPLATE_PREVIEW_ROOT_MARGIN,
    true,
  )

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
          <motion.img
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: reduced ? 0 : DURATION.base,
              ease: EASE.out,
            }}
            src={url}
            alt={`${item.name}首页静态预览`}
            width={preview?.asset.width}
            height={preview?.asset.height}
            className='aspect-[210/297] w-full object-cover object-top'
          />
        ) : status === 'loading' || status === 'idle' ? (
          <PaperSkeleton label={`正在加载${item.name}缩略图`} compact />
        ) : (
          <div className='flex aspect-[210/297] flex-col items-center justify-center gap-3 bg-muted/20 px-5 text-center'>
            <FileText aria-hidden className='size-8 text-muted-foreground/50' />
            <p className='text-sm font-medium'>{item.name}</p>
            <p className='text-xs text-muted-foreground'>
              {status === 'error'
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
