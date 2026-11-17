import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import type { ExperienceSourceReadResult } from '@/lib/experience-sources/types'
import {
  readExperienceContent,
  type ExperienceContentResult,
} from '@/lib/experience-sources/read-content'
import { useExperienceSourcesStore } from '@/store/experience-sources'
import ExperienceCitedBlock from '../cited-block'
import { experienceError } from '../utils'

function ReaderContent({
  sourceId,
  versionId,
  blockId,
  onLoaded,
}: {
  sourceId: string
  versionId?: string
  blockId?: string
  onLoaded?: (result: ExperienceSourceReadResult) => void
}) {
  const generation = useExperienceSourcesStore((state) => state.generation)
  const revision = useExperienceSourcesStore((state) => state.revision)
  const [result, setResult] = useState<ExperienceContentResult | null>(null)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const previousAttemptRef = useRef(0)
  const resolvedVersionRef = useRef(versionId)

  useEffect(() => {
    setResult(null)
    setOffset(0)
  }, [sourceId, versionId, generation])

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const refresh = attempt !== previousAttemptRef.current

    previousAttemptRef.current = attempt

    setLoading(true)
    setError(null)

    readExperienceContent({
      sourceId,
      versionId:
        versionId ?? (offset > 0 ? resolvedVersionRef.current : undefined),
      offset,
      refresh,
      signal: controller.signal,
      onMetadata: (metadata) => {
        if (active) onLoaded?.(metadata)
      },
    })
      .then((next) => {
        if (!active) return

        resolvedVersionRef.current = next.version.id

        setResult((previous) =>
          offset === 0
            ? next
            : {
                ...next,
                blocks: [...(previous?.blocks ?? []), ...next.blocks].filter(
                  (block, index, blocks) =>
                    blocks.findIndex((item) => item.id === block.id) === index,
                ),
              },
        )

        onLoaded?.(next)
      })
      .catch((cause) => {
        if (active) setError(experienceError(cause))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [sourceId, versionId, offset, generation, revision, attempt, onLoaded])

  const citedVersionId = versionId ?? result?.version.id

  return (
    <div className='mx-auto w-full max-w-3xl space-y-6 py-5'>
      {blockId && citedVersionId && (
        <ExperienceCitedBlock
          key={`${sourceId}:${citedVersionId}:${blockId}`}
          sourceId={sourceId}
          versionId={citedVersionId}
          blockId={blockId}
          onLoaded={onLoaded}
        />
      )}
      {blockId && <h3 className='text-sm font-medium'>完整原文</h3>}
      {result?.warning && (
        <p className='text-sm text-muted-foreground'>{result.warning}</p>
      )}
      {!result && loading ? (
        <div aria-label='正在读取原文' className='space-y-4'>
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className='h-16 w-full' />
          ))}
        </div>
      ) : null}
      {result?.blocks.map((block, index) => (
        <section
          key={block.id}
          id={`experience-${block.id}`}
          className='scroll-mt-5'
        >
          <p className='mb-1.5 text-xs text-muted-foreground'>
            {block.page ? `第 ${block.page} 页 · ` : ''}第 {index + 1} 段
          </p>
          <p className='whitespace-pre-wrap break-words text-sm leading-[1.7] sm:text-base'>
            {block.text}
          </p>
        </section>
      ))}
      {error && (
        <div role='alert' className='space-y-2 text-sm'>
          <p className='text-destructive'>{error}</p>
          <Button
            variant='outline'
            onClick={() => setAttempt((value) => value + 1)}
          >
            重新读取
          </Button>
        </div>
      )}
      {result?.hasMore && !error && (
        <Button
          variant='outline'
          disabled={loading}
          onClick={() => setOffset(result.blocks.length)}
        >
          {loading && <Spinner />}继续读取原文
        </Button>
      )}
    </div>
  )
}

export function ExperienceSourceReader(
  props: Parameters<typeof ReaderContent>[0],
) {
  const generation = useExperienceSourcesStore((state) => state.generation)

  return (
    <ReaderContent
      key={`${generation}:${props.sourceId}:${props.versionId ?? 'current'}:${props.blockId ?? ''}`}
      {...props}
    />
  )
}
