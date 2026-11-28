import { LoadingStatus } from '@/components/loading-status'
import { Button } from '@/components/ui/button'
import type { ReactNode } from 'react'
import type { useOptionPage } from '../../hooks/use-option-page'

interface OptionResultsProps {
  result: ReturnType<typeof useOptionPage>
  label: string
  emptyMessage: ReactNode
  showEmpty?: boolean
}

export function OptionResults({
  result,
  label,
  emptyMessage,
  showEmpty = true,
}: OptionResultsProps) {
  if (result.error)
    return (
      <div
        role='alert'
        className='flex items-center justify-between gap-2 p-3 text-sm'
      >
        <span>{label}加载失败</span>
        <Button
          type='button'
          size='sm'
          variant='outline'
          onClick={result.retry}
        >
          重试
        </Button>
      </div>
    )

  if (result.loading) return <LoadingStatus label={`正在加载${label}`} />

  if (!result.items.length && showEmpty)
    return (
      <div
        role='status'
        className='px-3 py-4 text-center text-sm text-muted-foreground'
      >
        {emptyMessage}
      </div>
    )

  return null
}

export function OptionPagination({
  result,
}: Pick<OptionResultsProps, 'result'>) {
  if (!result.page && !result.more) return null

  return (
    <div className='flex items-center justify-between gap-2 border-t p-1'>
      <Button
        type='button'
        size='sm'
        variant='ghost'
        disabled={!result.page}
        onClick={() => result.setPage(result.page - 1)}
      >
        上一页
      </Button>
      <span className='text-xs text-muted-foreground' aria-live='polite'>
        第 {result.page + 1} 页
      </span>
      <Button
        type='button'
        size='sm'
        variant='ghost'
        disabled={!result.more}
        onClick={() => result.setPage(result.page + 1)}
      >
        下一页
      </Button>
    </div>
  )
}
