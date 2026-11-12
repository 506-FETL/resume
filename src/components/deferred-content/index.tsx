import type { ComponentType, ReactNode } from 'react'
import type { MotionProps } from 'motion/react'
import { motion } from 'motion/react'
import { lazy, Suspense, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { FormSkeleton } from '@/components/loading-skeleton'
import { Button } from '@/components/ui/button'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { fadeInUp } from '@/lib/motion'

interface DeferredModule<Props> {
  default: ComponentType<Props>
}

export function createDeferredComponent<Props extends object>(
  loader: () => Promise<DeferredModule<Props>>,
  label: string,
  fallback?: ReactNode,
): ComponentType<Props> {
  let modulePromise: Promise<DeferredModule<Props>> | undefined

  const load = () => {
    modulePromise ??= loader().catch((error: unknown) => {
      modulePromise = undefined

      throw error
    })

    return modulePromise
  }

  let LazyContent = lazy(load)

  function DeferredComponent(props: Props) {
    const [Content, setContent] = useState(() => LazyContent)
    const reduced = useReducedMotion()

    const feedbackMotion = {
      variants: fadeInUp,
      initial: reduced ? false : 'hidden',
      animate: reduced
        ? { opacity: 1, y: 0, transition: { duration: 0 } }
        : 'visible',
    } satisfies MotionProps

    return (
      <ErrorBoundary
        onReset={() => {
          LazyContent = lazy(load)
          setContent(() => LazyContent)
        }}
        fallbackRender={({ resetErrorBoundary }) => (
          <motion.div
            {...feedbackMotion}
            className='flex min-h-32 flex-col items-center justify-center gap-3 p-4 text-center text-sm'
          >
            <p role='alert' className='text-muted-foreground'>
              暂时无法加载{label}
            </p>
            <Button variant='outline' size='sm' onClick={resetErrorBoundary}>
              重试
            </Button>
          </motion.div>
        )}
      >
        <Suspense
          fallback={
            <motion.div {...feedbackMotion} className='py-3 text-center'>
              {fallback ?? <FormSkeleton label={`正在加载${label}`} />}
            </motion.div>
          }
        >
          <Content {...props} />
        </Suspense>
      </ErrorBoundary>
    )
  }

  return DeferredComponent
}
