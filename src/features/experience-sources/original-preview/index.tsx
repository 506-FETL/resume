import { prepareOriginalViewer } from './prepare'
import { useEffect, useState } from 'react'
import {
  PdfPreview,
  DocxPreview,
  SpreadsheetPreview,
  ImagePreview,
} from './viewers'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { ExperienceSourceVersion } from '@/lib/experience-sources/types'
import { useExperienceSourcesStore } from '@/store/experience-sources'
import { experienceError } from '../utils'
import { experiencePreviewKind } from '../../../../supabase/functions/shared/experience-file-formats'

export default function ExperienceOriginalPreview({
  sourceId,
  version,
}: {
  sourceId: string
  version: ExperienceSourceVersion
}) {
  const generation = useExperienceSourcesStore((state) => state.generation)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const kind = experiencePreviewKind(version.fileName ?? '')
  const isText = kind === 'text'

  useEffect(() => {
    if (!kind) return

    let active = true

    prepareOriginalViewer(kind)?.catch(() => {})

    setBlob(null)
    setText(null)
    setError(null)

    useExperienceSourcesStore
      .getState()
      .original(sourceId, version.id)
      .then(async (next) => {
        const originalText = isText ? await next.text() : null

        if (!active) return

        setBlob(next)
        setText(originalText)
      })
      .catch((cause) => {
        if (active) setError(experienceError(cause))
      })

    return () => {
      active = false
    }
  }, [sourceId, version.id, generation, kind, isText, attempt])

  if (!kind)
    return (
      <div className='my-5 space-y-2 rounded-lg border p-5'>
        <FileText className='size-6 text-muted-foreground' aria-hidden />
        <p className='break-words text-sm font-medium'>{version.fileName}</p>
        <p className='text-xs text-muted-foreground'>
          原件已保存
          {version.fileSize !== null
            ? ` · ${(version.fileSize / 1024).toFixed(1)} KB`
            : ''}
          。此格式暂不支持在线预览，请下载查看。
        </p>
      </div>
    )

  return (
    <div className='py-5'>
      {error ? (
        <div role='alert' className='space-y-2 text-sm'>
          <p className='text-destructive'>{error}</p>
          <Button
            variant='outline'
            onClick={() => setAttempt((value) => value + 1)}
          >
            重新读取原件
          </Button>
        </div>
      ) : !blob ? (
        <Skeleton
          className='aspect-[210/297] w-full'
          aria-label='正在读取原件'
        />
      ) : kind === 'pdf' ? (
        <PdfPreview blob={blob} />
      ) : kind === 'docx' ? (
        <DocxPreview blob={blob} name={version.fileName!} />
      ) : kind === 'spreadsheet' ? (
        <SpreadsheetPreview blob={blob} name={version.fileName!} />
      ) : kind === 'image' ? (
        <ImagePreview blob={blob} name={version.fileName!} />
      ) : (
        <pre className='whitespace-pre-wrap break-words font-sans text-sm leading-relaxed'>
          {text}
        </pre>
      )}
    </div>
  )
}
