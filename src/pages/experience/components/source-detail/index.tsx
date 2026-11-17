import { prepareOriginalViewer } from '@/features/experience-sources/original-preview/prepare'
import { useCallback, useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBytes } from '@/components/ui/file-upload/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

import { ExperienceSourceReader } from '@/features/experience-sources'
import {
  experienceError,
  formatSourceDate,
  KIND_LABEL,
  STATUS_LABEL,
} from '@/features/experience-sources/utils'
import ExperienceOriginalPreview from '@/features/experience-sources/original-preview'
import { Skeleton } from '@/components/ui/skeleton'
import type {
  ExperienceSourceReadResult,
  ExperienceSource,
} from '@/lib/experience-sources/types'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useExperienceSourcesStore } from '@/store/experience-sources'

import { SourceActions } from './source-actions'

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
  const [showExtracted, setShowExtracted] = useState(false)
  const [readAttempt, setReadAttempt] = useState(0)
  const [readError, setReadError] = useState<string | null>(null)
  const [detail, setDetail] = useState<ExperienceSourceReadResult | null>(null)
  const reduced = useReducedMotion()
  const targetVersion = versionId ?? listSource?.currentVersionId
  const sourceKind = listSource?.kind
  const isCurrentVersion = targetVersion === listSource?.currentVersionId

  useEffect(() => {
    let active = true

    setReadError(null)

    if (
      targetVersion &&
      isCurrentVersion &&
      sourceKind &&
      sourceKind !== 'paste'
    ) {
      prepareOriginalViewer(sourceKind)?.catch(() => {})

      useExperienceSourcesStore
        .getState()
        .original(sourceId, targetVersion)
        .catch(() => {})
    }

    useExperienceSourcesStore
      .getState()
      .read(sourceId, targetVersion ?? undefined, 0, readAttempt > 0)
      .then((next) => {
        if (active) setDetail(next)
      })
      .catch((cause) => {
        if (active) setReadError(experienceError(cause))
      })

    return () => {
      active = false
    }
  }, [sourceId, targetVersion, sourceKind, isCurrentVersion, readAttempt])

  const onLoaded = useCallback(
    (next: ExperienceSourceReadResult) => setDetail(next),
    [],
  )

  const source = listSource ?? detail?.source

  const targetVersionId = versionId ?? listSource?.currentVersionId

  const reference =
    detail && (!targetVersionId || detail.version.id === targetVersionId)
      ? {
          sourceId,
          versionId: detail.version.id,
          name: source?.name ?? detail.source.name,
        }
      : null

  return (
    <>
      <div className='space-y-4 border-b border-border/60 pb-5'>
        <h1 className='line-clamp-3 break-words text-xl leading-snug font-semibold sm:text-2xl'>
          {source?.name ?? '资料原文'}
        </h1>
        {source && (
          <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground'>
            <p>
              {KIND_LABEL[source.kind]} · 更新于{' '}
              {formatSourceDate(source.updatedAt)}
            </p>
            {source.name.length > 32 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='h-auto px-1 py-0.5 text-xs text-muted-foreground'
                  >
                    完整名称
                  </Button>
                </PopoverTrigger>
                <PopoverContent className='max-w-[calc(100vw-2rem)] break-words text-sm'>
                  {source.name}
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}
        <SourceActions
          sourceId={sourceId}
          source={source}
          detail={detail}
          reference={reference}
          onRenamed={(updatedSource) =>
            setDetail((current) =>
              current ? { ...current, source: updatedSource } : current,
            )
          }
        />
        {source && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button
                variant='ghost'
                size='sm'
                className='text-muted-foreground'
              >
                资料信息
                <ChevronDown />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent
              style={reduced ? { animationDuration: '0s' } : undefined}
            >
              <div className='space-y-1 pb-3 text-xs leading-5 text-muted-foreground'>
                {detail && (
                  <>
                    <p>
                      此版本保存于 {formatSourceDate(detail.version.createdAt)}{' '}
                      ·{' '}
                      {detail.version.fileName
                        ? detail.version.fileSize !== null
                          ? formatBytes(detail.version.fileSize)
                          : '文件原件'
                        : `${detail.version.textLength} 字符 · ${detail.version.blockCount} 段`}
                    </p>
                    <p>
                      {detail.version.id === source.currentVersionId
                        ? '当前版本'
                        : '历史版本，引用继续保留此版本原文。'}
                    </p>
                  </>
                )}
                <p>{STATUS_LABEL[source.status]}</p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
      {!detail && !readError && (
        <Skeleton className='my-5 aspect-[210/297] w-full' />
      )}
      {readError && (
        <div role='alert' className='space-y-2 py-5 text-sm'>
          <p className='text-destructive'>{readError}</p>
          <Button
            variant='outline'
            onClick={() => setReadAttempt((value) => value + 1)}
          >
            重新读取
          </Button>
        </div>
      )}
      {detail?.version.fileName && (
        <ExperienceOriginalPreview
          key={detail.version.id}
          sourceId={sourceId}
          version={detail.version}
        />
      )}
      {detail?.version.fileName &&
        detail.version.blockCount > 0 &&
        !blockId && (
          <Collapsible open={showExtracted} onOpenChange={setShowExtracted}>
            <CollapsibleTrigger asChild>
              <Button variant='outline'>
                提取文字
                <ChevronDown />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent
              style={reduced ? { animationDuration: '0s' } : undefined}
            >
              <ExperienceSourceReader
                sourceId={sourceId}
                versionId={detail.version.id}
                onLoaded={onLoaded}
              />
            </CollapsibleContent>
          </Collapsible>
        )}
      {detail && (!detail.version.fileName || blockId) && (
        <ExperienceSourceReader
          sourceId={sourceId}
          versionId={detail.version.id}
          blockId={blockId}
          onLoaded={onLoaded}
        />
      )}
    </>
  )
}
