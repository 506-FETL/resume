import { useEffect, useState } from 'react'
import { createDeferredComponent } from '@/components/deferred-content'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { prepareOriginalViewer } from '@/features/experience-sources/original-preview/prepare'
import { experienceError } from '@/features/experience-sources/utils'
import type {
  ExperienceSource,
  ExperienceSourceReadResult,
} from '@/lib/experience-sources/types'
import { useExperienceSourcesStore } from '@/store/experience-sources'
import { experiencePreviewKind } from '../../../../../supabase/functions/shared/experience-file-formats'

const SourceDetailContent = createDeferredComponent(
  () => import('./content'),
  '资料详情',
  <Skeleton className='my-5 aspect-[210/297] w-full' />,
  { wrapFallback: false },
)

export default function SourceDetail({
  sourceId,
  versionId,
  blockId,
  listSource,
}: {
  sourceId: string
  versionId?: string
  blockId?: string
  listSource?: ExperienceSource
}) {
  const [readAttempt, setReadAttempt] = useState(0)
  const [readError, setReadError] = useState<string | null>(null)
  const [detail, setDetail] = useState<ExperienceSourceReadResult | null>(null)
  const [original, setOriginal] = useState<Promise<Blob>>()
  const targetVersion = versionId ?? listSource?.currentVersionId ?? undefined

  const sourceKind =
    targetVersion === listSource?.currentVersionId
      ? listSource?.kind
      : undefined

  useEffect(() => {
    let active = true
    let prepared: Promise<Blob> | undefined
    const store = useExperienceSourcesStore.getState()
    const metadata = store.read(sourceId, targetVersion, 0, readAttempt > 0)

    setReadError(null)
    setDetail(null)
    setOriginal(undefined)

    function preparePreview(version: string, kind: string) {
      prepareOriginalViewer(kind)?.catch(() => {})

      prepared = store.original(sourceId, version)
      // 保留这一次读取的结果，由原件区域展示错误并提供重试。
      prepared.catch(() => {})
    }

    if (
      targetVersion &&
      sourceKind &&
      sourceKind !== 'file' &&
      sourceKind !== 'paste'
    )
      preparePreview(targetVersion, sourceKind)

    metadata
      .then((next) => {
        if (!active) return

        const kind =
          next.version.fileName && experiencePreviewKind(next.version.fileName)

        if (kind && !prepared) preparePreview(next.version.id, kind)

        setOriginal(prepared)
        setDetail(next)
      })
      .catch((cause) => {
        if (active) setReadError(experienceError(cause))
      })

    return () => {
      active = false
    }
  }, [sourceId, targetVersion, sourceKind, readAttempt])

  const current =
    !targetVersion || targetVersion === detail?.version.id ? detail : null

  const source = listSource ?? current?.source

  return (
    <>
      <h1 className='mb-4 line-clamp-3 break-words text-xl leading-snug font-semibold sm:text-2xl'>
        {source?.name ?? '资料原文'}
      </h1>
      {readError ? (
        <div role='alert' className='space-y-2 py-5 text-sm'>
          <p className='text-destructive'>{readError}</p>
          <Button
            variant='outline'
            onClick={() => setReadAttempt((value) => value + 1)}
          >
            重新读取
          </Button>
        </div>
      ) : (
        <SourceDetailContent
          sourceId={sourceId}
          blockId={blockId}
          source={source}
          detail={current}
          onLoaded={setDetail}
          preparedOriginal={original}
        />
      )}
    </>
  )
}
