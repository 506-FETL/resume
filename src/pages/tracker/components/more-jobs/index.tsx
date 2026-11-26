import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'

interface MoreJobsProps {
  more: boolean
  error?: string
  loading: boolean
  advance: () => void
}

export function MoreJobs({ more, error, loading, advance }: MoreJobsProps) {
  const targetRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (
      !more ||
      error ||
      loading ||
      !targetRef.current ||
      !window.IntersectionObserver
    )
      return

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        advance()
      }
    })

    observer.observe(targetRef.current)

    return () => observer.disconnect()
  }, [advance, error, loading, more])

  if (!more && !error) return null

  return (
    <div className='flex shrink-0 flex-col items-center py-1'>
      {error && (
        <span className='text-xs text-destructive' role='alert'>
          {error}
        </span>
      )}
      <Button
        ref={targetRef}
        variant='ghost'
        size='sm'
        disabled={loading}
        onClick={advance}
      >
        {loading ? '正在加载职位…' : error ? '重试加载' : '加载更多职位'}
      </Button>
    </div>
  )
}
