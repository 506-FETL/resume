import type { ReactNode } from 'react'
import type {
  ExampleRef,
  TemplateCatalogItem,
} from '@/lib/resume-template/source/types'
import { useEffect, useId, useLayoutEffect, useRef } from 'react'
import { LayoutGroup, motion, useAnimationControls } from 'motion/react'
import AnimatedContent from '@/components/motion/animated-content'
import { PaperSkeleton } from '@/components/loading-skeleton'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import { exampleKey } from '@/lib/resume-template/source/types'
import { cn } from '@/lib/utils'
import { useTemplatePreview } from '../../hooks/use-template-preview'
import { useTemplatePageStore } from '../../store'
import ExamplePicker from '../example-picker'
import ExamplePreview from '../example-preview'

export default function PreviewWorkspace({
  item,
  example,
  mobile,
  disabled,
  children,
}: {
  item: TemplateCatalogItem
  example: ExampleRef
  mobile: boolean
  disabled: boolean
  children: ReactNode
}) {
  const layoutId = useId()
  const reduceMotion = useReducedMotion()
  const formControls = useAnimationControls()
  const detailsScrollRef = useRef<HTMLDivElement>(null)

  const details = useTemplatePageStore(
    (state) => state.previewStep === 'details',
  )

  const preview = item.previews.find(
    (entry) =>
      entry.templateVersion === item.currentVersion &&
      exampleKey(entry.example) === exampleKey(example),
  )

  const thumbnail = useTemplatePreview(preview, true)

  useLayoutEffect(() => {
    if (!details && detailsScrollRef.current)
      detailsScrollRef.current.scrollTop = 0
  }, [details])

  useEffect(() => {
    const target = {
      opacity: details ? 1 : 0,
      transform: `translateY(${details || reduceMotion ? 0 : 8}px)`,
    }

    if (reduceMotion) formControls.set(target)
    else
      formControls.start({
        ...target,
        transition: {
          duration: details ? DURATION.base : DURATION.fast,
          delay: details ? DURATION.fast / 2 : 0,
          ease: EASE.out,
        },
      })

    return () => formControls.stop()
  }, [details, reduceMotion, formControls])

  return (
    <LayoutGroup id={layoutId}>
      <div
        className='relative min-h-0 flex-1 overflow-hidden'
        data-catalog-workspace
      >
        <motion.div
          data-catalog-preview-panel
          inert={details}
          aria-hidden={details}
          className='absolute inset-0 flex'
          initial={false}
          animate={{ opacity: details ? 0 : 1 }}
          transition={{
            duration: reduceMotion ? 0 : DURATION.fast,
            ease: EASE.out,
          }}
        >
          <motion.div
            layoutScroll
            data-catalog-preview-scroll
            className='min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-muted/50 p-4 sm:p-7'
          >
            <AnimatedContent
              animationKey={`${item.templateId}@${item.currentVersion}:${exampleKey(example)}`}
              className='mx-auto max-w-2xl'
            >
              <motion.div
                key={reduceMotion ? 'reduced' : 'motion'}
                layout={reduceMotion ? false : 'preserve-aspect'}
                layoutId={reduceMotion ? undefined : 'selected-paper'}
                // 只在切步时投影尺寸，资源就绪后的高度变化不能拉伸整页。
                layoutDependency={`preview-${details}`}
                data-framer-portal-id={layoutId}
                data-catalog-preview-paper
                transition={{
                  duration: reduceMotion ? 0 : DURATION.slow,
                  ease: EASE.out,
                }}
              >
                <ExamplePreview item={item} example={example} />
              </motion.div>
            </AnimatedContent>
          </motion.div>
          {!mobile && (
            <aside
              aria-label='模板详情'
              className='flex w-80 shrink-0 flex-col gap-6 overflow-y-auto border-l p-6'
            >
              <div className='space-y-3'>
                {item.category && (
                  <p className='text-xs text-muted-foreground'>
                    {item.category.style}风格 · {item.category.layout}排版
                  </p>
                )}
                <p className='text-sm leading-6'>{item.description}</p>
              </div>
              <ExamplePicker
                item={item}
                selectedExample={example}
                disabled={disabled}
              />
              <p className='mt-auto border-t pt-4 text-xs leading-6 text-muted-foreground'>
                创建后会带入所选示例，你可以在编辑器中逐项替换内容、调整模块并导出简历。
              </p>
            </aside>
          )}
        </motion.div>
        <motion.div
          ref={detailsScrollRef}
          layoutScroll
          data-catalog-details-panel
          inert={!details}
          aria-hidden={!details}
          className={cn(
            'absolute inset-0 overflow-y-auto overscroll-y-contain',
            !details && 'pointer-events-none',
          )}
        >
          <div className='relative min-h-full md:grid md:grid-cols-[56%_44%]'>
            <div className='relative h-[clamp(20rem,44svh,24rem)] w-full overflow-hidden [mask-image:linear-gradient(to_bottom,#000_40%,#0009_68%,transparent_100%)] md:absolute md:inset-y-0 md:left-0 md:h-full md:w-[58%] md:[mask-image:linear-gradient(to_right,#000_20%,transparent_100%)]'>
              {details && (
                <motion.div
                  key={reduceMotion ? 'reduced' : 'motion'}
                  layout={reduceMotion ? false : 'preserve-aspect'}
                  layoutId={reduceMotion ? undefined : 'selected-paper'}
                  layoutDependency='details'
                  data-framer-portal-id={layoutId}
                  data-catalog-background
                  className='w-full overflow-hidden'
                  style={
                    preview
                      ? {
                          aspectRatio: `${preview.asset.width} / ${preview.asset.height}`,
                        }
                      : undefined
                  }
                  transition={{
                    duration: reduceMotion ? 0 : DURATION.slow,
                    ease: EASE.out,
                  }}
                >
                  {thumbnail.url ? (
                    <motion.div
                      initial={reduceMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{
                        duration: reduceMotion ? 0 : DURATION.base,
                        ease: EASE.out,
                      }}
                    >
                      <img
                        src={thumbnail.url}
                        alt={`${item.name}排版预览`}
                        width={preview?.asset.width}
                        height={preview?.asset.height}
                        className='h-auto w-full dark:opacity-60'
                      />
                    </motion.div>
                  ) : thumbnail.status === 'loading' ? (
                    <PaperSkeleton label='正在加载模板预览' />
                  ) : (
                    <div className='[&_[data-resume-page]]:rounded-none [&_[data-resume-page]]:shadow-none [&_[data-resume-page]]:ring-0'>
                      <ExamplePreview item={item} example={example} />
                    </div>
                  )}
                </motion.div>
              )}
            </div>
            <motion.div
              data-catalog-creation-form
              className='relative z-10 -mt-6 px-5 pb-5 md:col-start-2 md:my-auto md:py-10 md:pr-8 md:pl-2'
              initial={{
                opacity: 0,
                transform: `translateY(${reduceMotion ? 0 : 8}px)`,
              }}
              animate={formControls}
            >
              {children}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </LayoutGroup>
  )
}
