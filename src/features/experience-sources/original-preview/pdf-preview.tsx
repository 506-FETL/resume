import { usePdfPreview } from './use-pdf-preview'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'

export default function PdfPreview({ blob }: { blob: Blob }) {
  const reduced = useReducedMotion()

  const {
    containerRef,
    pageNumber,
    setPageNumber,
    pageCount,
    loading,
    error,
    retry,
  } = usePdfPreview(blob)

  return (
    <div className='space-y-3'>
      <div
        className='flex items-center justify-between gap-2'
        aria-label='PDF 翻页'
      >
        <Button
          variant='outline'
          size='sm'
          disabled={loading || pageNumber === 1}
          onClick={() => setPageNumber((number) => number - 1)}
        >
          上一页
        </Button>
        <p
          className='flex items-center gap-2 text-xs text-muted-foreground'
          aria-live='polite'
        >
          {loading && <Spinner className='size-3' />}
          {pageCount ? `第 ${pageNumber} / ${pageCount} 页` : '正在打开 PDF'}
        </p>
        <Button
          variant='outline'
          size='sm'
          disabled={loading || !pageCount || pageNumber >= pageCount}
          onClick={() => setPageNumber((number) => number + 1)}
        >
          下一页
        </Button>
      </div>
      {!pageCount && !error && (
        <Skeleton
          className='aspect-[210/297] w-full'
          aria-label='正在打开 PDF 原件'
        />
      )}
      <motion.div
        ref={containerRef}
        className='min-h-0 overflow-hidden rounded-md'
        animate={{ opacity: loading ? 0.65 : 1 }}
        transition={{ duration: reduced ? 0 : DURATION.fast, ease: EASE.out }}
        aria-busy={loading}
      />
      {error && (
        <div role='alert' className='space-y-2 text-sm'>
          <p className='text-destructive'>{error}</p>
          <Button variant='outline' onClick={retry}>
            重新打开 PDF
          </Button>
        </div>
      )}
      <p className='text-xs text-muted-foreground'>
        需要复制文字时，可打开下方提取文字。
      </p>
    </div>
  )
}
