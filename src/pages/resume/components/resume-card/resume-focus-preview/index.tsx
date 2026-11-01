import type {
  ResumePreviewEntry,
  ResumePreviewRequest,
} from '../../../store/preview-types'
import { AnimatePresence, motion, useInView, useIsPresent } from 'motion/react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { CONTENT_SWITCH, DURATION, EASE } from '@/lib/motion'
import { useResumePreviewStore } from '../../../store/preview-cache'
import { resumePreviewKey } from '../../../store/preview-types'

export default function ResumeFocusPreview({
  accountId,
  resumeId,
  updatedAt,
  templateBinding,
}: ResumePreviewRequest) {
  const previewRef = useRef<HTMLDivElement>(null)
  const visible = useInView(previewRef)
  const present = useIsPresent()

  const request = useMemo(
    () => ({ accountId, resumeId, updatedAt, templateBinding }),
    [accountId, resumeId, updatedAt, templateBinding],
  )

  const key = resumePreviewKey(request)
  const entry = useResumePreviewStore((state) => state.entries[key])
  const acquire = useResumePreviewStore((state) => state.acquire)
  const retry = useResumePreviewStore((state) => state.retry)

  useEffect(() => {
    if (!visible || !present) return

    return acquire(request)
  }, [acquire, present, request, visible, key])

  return (
    <div
      ref={previewRef}
      className='pointer-events-none relative self-start sm:row-span-2 sm:self-center [&_button]:pointer-events-auto'
      data-resume-preview-state={entry?.status ?? 'idle'}
    >
      <div className='relative aspect-[210/297] w-full overflow-hidden rounded-sm bg-white shadow-md'>
        <PreviewContent key={key} entry={entry} onRetry={() => retry(key)} />
      </div>
    </div>
  )
}

function PreviewContent({
  entry,
  onRetry,
}: {
  entry: ResumePreviewEntry | undefined
  onRetry: () => void
}) {
  const reduceMotion = useReducedMotion()
  const [cachedOnMount] = useState(entry?.status === 'ready')
  const paperRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const ready = entry?.status === 'ready'
  const paper = ready ? entry.paper : null

  useLayoutEffect(() => {
    const element = paperRef.current

    if (!element) return

    const updateWidth = () => setWidth(element.clientWidth)
    const observer = new ResizeObserver(updateWidth)

    updateWidth()
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return (
    <div ref={paperRef} className='absolute inset-0'>
      {paper && (
        <motion.div
          inert
          aria-hidden
          initial={
            cachedOnMount || reduceMotion ? false : { opacity: 0, scale: 0.98 }
          }
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: reduceMotion ? 0 : DURATION.base,
            ease: EASE.out,
          }}
          className='pointer-events-none absolute inset-0'
        >
          <div
            className='origin-top-left'
            style={{
              width: paper.width,
              height: paper.height,
              transform: `scale(${width / paper.width})`,
            }}
            dangerouslySetInnerHTML={{ __html: paper.html }}
          />
        </motion.div>
      )}
      <AnimatePresence initial={false} mode='wait'>
        {!ready && (
          <motion.div
            key={entry?.status === 'error' ? 'error' : 'loading'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{
              opacity: 0,
              transition: {
                ...CONTENT_SWITCH.exit,
                duration: reduceMotion ? 0 : CONTENT_SWITCH.exit.duration,
              },
            }}
            transition={{
              duration: reduceMotion ? 0 : DURATION.fast,
              ease: EASE.out,
            }}
            className='absolute inset-0 flex flex-col items-center justify-center gap-2 px-2 text-center text-xs text-neutral-500'
            role='status'
          >
            {(entry?.status === 'generating' || entry?.status === 'queued') && (
              <Spinner
                aria-hidden
                className={reduceMotion ? 'animate-none' : undefined}
              />
            )}
            <span>
              {entry?.status === 'error'
                ? '预览暂时不可用'
                : entry
                  ? '正在加载预览…'
                  : '简历预览'}
            </span>
            {entry?.status === 'error' && (
              <Button
                variant='link'
                size='sm'
                className='text-neutral-700'
                onClick={onRetry}
              >
                重试
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
