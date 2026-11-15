import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import type { ExperienceSourceReadResult } from '@/lib/experience-sources/types'
import { useExperienceSourcesStore } from '@/store/experience-sources'
import { experienceError } from '../utils'

export default function ExperienceCitedBlock({
  sourceId,
  versionId,
  blockId,
  onLoaded,
}: {
  sourceId: string
  versionId?: string
  blockId: string
  onLoaded?: (result: ExperienceSourceReadResult) => void
}) {
  const [result, setResult] = useState<ExperienceSourceReadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [highlighted, setHighlighted] = useState(false)
  const targetRef = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const revision = useExperienceSourcesStore((state) => state.revision)
  const block = result?.blocks.find((item) => item.id === blockId)

  useEffect(() => {
    let active = true

    setError(null)

    useExperienceSourcesStore
      .getState()
      .read(sourceId, versionId, 0, attempt > 0, [blockId])
      .then((next) => {
        if (!active) return

        setResult(next)
        onLoaded?.(next)
      })
      .catch((cause) => {
        if (active) setError(experienceError(cause))
      })

    return () => {
      active = false
    }
  }, [sourceId, versionId, blockId, attempt, revision, onLoaded])

  useLayoutEffect(() => {
    if (!block || !targetRef.current) return

    targetRef.current.scrollIntoView({ behavior: 'instant', block: 'nearest' })
    setHighlighted(true)

    const timer = setTimeout(() => setHighlighted(false), 1200)

    return () => clearTimeout(timer)
  }, [block])

  return (
    <section
      ref={targetRef}
      data-experience-cited-block={blockId}
      className='relative scroll-mt-5 space-y-2 rounded-md p-3'
    >
      <motion.div
        aria-hidden
        className='pointer-events-none absolute inset-0 rounded-md bg-primary/5 ring-1 ring-primary/40'
        initial={false}
        animate={{ opacity: highlighted ? 1 : 0 }}
        transition={{ duration: reduced ? 0 : DURATION.base, ease: EASE.out }}
      />
      <h3 className='relative text-sm font-medium'>
        引用段落{block?.page ? ` · 第 ${block.page} 页` : ''}
      </h3>
      {block ? (
        <p className='relative whitespace-pre-wrap break-words text-sm leading-[1.7] sm:text-base'>
          {block.text}
        </p>
      ) : error ? (
        <div role='alert' className='relative space-y-2 text-sm'>
          <p className='text-destructive'>引用段落暂不可定位：{error}</p>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setAttempt((value) => value + 1)}
          >
            重试定位
          </Button>
        </div>
      ) : result ? (
        <p role='alert' className='relative text-sm text-destructive'>
          这份原文中没有对应的引用段落。
        </p>
      ) : (
        <Skeleton className='h-20 w-full' />
      )}
    </section>
  )
}
