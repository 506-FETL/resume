import { PaperSkeleton } from '@/components/loading-skeleton'
import { Button } from '@/components/ui/button'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import type {
  ExampleRef,
  TemplateCatalogItem,
} from '@/lib/resume-template/source/types'
import { cn } from '@/lib/utils'
import { useTemplateIntersection } from '@/pages/template/hooks/use-template-intersection'
import { useTemplatePreview } from '@/pages/template/hooks/use-template-preview'
import { Check, FileText } from 'lucide-react'
import { motion, useAnimationControls } from 'motion/react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export function TemplateOption({
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
    <motion.img
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: reduceMotion ? 0 : DURATION.base,
        ease: EASE.out,
      }}
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
      {status === 'loading' || status === 'idle' ? (
        <PaperSkeleton label='正在加载模板预览' className='h-full' compact />
      ) : (
        <FileText className='size-6' />
      )}
      {status !== 'loading' && status !== 'idle' && (
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
          <span className='block truncate border-t px-2.5 py-2 text-xs font-medium'>
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
