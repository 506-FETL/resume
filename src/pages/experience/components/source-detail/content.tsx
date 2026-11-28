import { useState } from 'react'
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
import { LoadingStatus } from '@/components/loading-status'
import { ExperienceSourceReader } from '@/features/experience-sources/source-reader'
import {
  formatSourceDate,
  KIND_LABEL,
  STATUS_LABEL,
} from '@/features/experience-sources/utils'
import ExperienceOriginalPreview from '@/features/experience-sources/original-preview'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import type {
  ExperienceSource,
  ExperienceSourceReadResult,
} from '@/lib/experience-sources/types'
import { SourceActions } from './source-actions'

export default function SourceDetailContent({
  sourceId,
  blockId,
  source,
  detail,
  onLoaded,
  preparedOriginal,
}: {
  sourceId: string
  blockId?: string
  source?: ExperienceSource
  detail: ExperienceSourceReadResult | null
  onLoaded: (next: ExperienceSourceReadResult) => void
  preparedOriginal?: Promise<Blob>
}) {
  const [showExtracted, setShowExtracted] = useState(false)
  const reduced = useReducedMotion()

  return (
    <>
      <div className='space-y-4 border-b border-border/60 pb-5'>
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
        {detail && (
          <SourceActions
            sourceId={sourceId}
            source={source ?? detail.source}
            detail={detail}
            reference={{
              sourceId,
              versionId: detail.version.id,
              name: source?.name ?? detail.source.name,
            }}
            onRenamed={(updatedSource) =>
              onLoaded({ ...detail, source: updatedSource })
            }
          />
        )}
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
      {!detail && <LoadingStatus label='正在读取资料内容' className='px-0' />}
      {detail?.version.fileName && (
        <ExperienceOriginalPreview
          key={detail.version.id}
          sourceId={sourceId}
          version={detail.version}
          preparedOriginal={preparedOriginal}
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
