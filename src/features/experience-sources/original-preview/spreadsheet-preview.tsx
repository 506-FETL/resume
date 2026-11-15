import { useEffect, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { createSpreadsheetSession } from '@/lib/experience-sources/spreadsheet-session'
import type { SpreadsheetPage } from '@/lib/experience-sources/spreadsheet-types'
import { DURATION, EASE } from '@/lib/motion'
import { PreviewError } from './preview-error'
import './spreadsheet-preview.css'

export default function SpreadsheetPreview({
  blob,
  name,
}: {
  blob: Blob
  name: string
}) {
  const sessionRef = useRef<ReturnType<typeof createSpreadsheetSession> | null>(
    null,
  )

  const [sheets, setSheets] = useState<string[]>([])
  const [sheet, setSheet] = useState('')
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<SpreadsheetPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const reduced = useReducedMotion()

  useEffect(() => {
    const session = createSpreadsheetSession()
    let active = true

    sessionRef.current = session
    setError(null)
    setResult(null)
    setSheets([])
    setSheet('')
    setPage(0)
    setLoading(true)

    session
      .open(blob, name.split('.').pop()!.toLowerCase())
      .then((names) => {
        if (!active) return

        setSheets(names)
        setSheet(names[0])
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : '表格无法读取。')
          setLoading(false)
        }
      })

    return () => {
      active = false
      session.dispose()
    }
  }, [blob, name, attempt])

  useEffect(() => {
    const session = sessionRef.current

    if (!sheet || !session) return

    let active = true

    setLoading(true)

    session
      .preview(sheet, page)
      .then((next) => {
        if (!active) return

        setResult({
          ...next,
          html: DOMPurify.sanitize(next.html, {
            ALLOWED_TAGS: ['table', 'thead', 'tbody', 'tr', 'td', 'th', 'br'],
            ALLOWED_ATTR: ['rowspan', 'colspan'],
          }),
        })

        setLoading(false)
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : '表格无法预览。')
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [sheet, page, attempt])

  if (error)
    return (
      <PreviewError message={error} onRetry={() => setAttempt(attempt + 1)} />
    )

  return (
    <div className='min-w-0 space-y-3' aria-busy={loading}>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <Select
          value={sheet}
          onValueChange={(value) => {
            setSheet(value)
            setPage(0)
          }}
          disabled={!sheets.length}
        >
          <SelectTrigger className='w-52 max-w-full' aria-label='工作表'>
            <SelectValue placeholder='正在读取工作表' />
          </SelectTrigger>
          <SelectContent>
            {sheets.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {result && (
          <div className='flex items-center gap-2 text-xs text-muted-foreground'>
            {loading && <Spinner />}
            <Button
              variant='ghost'
              size='icon-sm'
              aria-label='上一页表格'
              disabled={loading || page === 0}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft />
            </Button>
            <span aria-live='polite'>
              {result.page + 1} / {result.pages}
            </span>
            <Button
              variant='ghost'
              size='icon-sm'
              aria-label='下一页表格'
              disabled={loading || page + 1 >= result.pages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        )}
      </div>
      {!result ? (
        <Skeleton className='h-80 w-full' />
      ) : (
        <motion.div
          key={`${sheet}:${result.page}`}
          initial={{ opacity: reduced ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduced ? 0 : DURATION.fast, ease: EASE.out }}
        >
          {result.html ? (
            <div
              role='region'
              aria-label={`${sheet} 单元格 ${result.range}`}
              tabIndex={0}
              className='experience-spreadsheet max-h-[65dvh] overflow-auto rounded-lg border'
              dangerouslySetInnerHTML={{ __html: result.html }}
            />
          ) : (
            <p className='rounded-lg border p-8 text-center text-sm text-muted-foreground'>
              这个工作表没有内容。
            </p>
          )}
        </motion.div>
      )}
      <p className='text-xs text-muted-foreground'>
        显示已保存的单元格值，公式不会重新计算。
      </p>
    </div>
  )
}
