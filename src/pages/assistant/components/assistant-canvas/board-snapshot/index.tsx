import type { CanvasModel } from '../../../types'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import AnimatedContent from '@/components/motion/animated-content'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  loadCanvasBoard,
  useCanvasResources,
} from '../../../hooks/canvas-resources'
import useAssistantStore from '../../../store'

const STATUS_LABELS: Record<string, string> = {
  saved: '已保存',
  applied: '已投递',
  screen: '筛选中',
  interview: '面试中',
  offer: '已录用',
  rejected: '已终止',
}

export default function BoardSnapshot({ model }: { model: CanvasModel }) {
  const canvasVisible = useAssistantStore((s) =>
    s.layoutMode === 'drawer' ? s.canvasMobileOpen : s.canvasOpen,
  )

  const [page, setPage] = useState(0)

  const [result, setResult] = useState<{
    page: number
    data: Awaited<ReturnType<typeof loadCanvasBoard>>
  } | null>(null)

  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const { generation, boardRevision } = useCanvasResources()
  const activeTab = useAssistantStore((state) => state.canvasActiveTab)
  const [loadedGeneration, setLoadedGeneration] = useState(generation)

  useEffect(() => {
    if (!canvasVisible || activeTab !== 'board') return

    let cancelled = false

    setError(false)

    loadCanvasBoard(page)
      .then((data) => {
        if (
          !cancelled &&
          generation === useCanvasResources.getState().generation
        ) {
          if (!data.rows.length && page > 0) {
            setPage(page - 1)

            return
          }

          setResult({ page, data })
          setLoadedGeneration(generation)
        }
      })
      .catch(() => {
        if (
          !cancelled &&
          generation === useCanvasResources.getState().generation
        )
          setError(true)
      })

    return () => {
      cancelled = true
    }
  }, [canvasVisible, activeTab, generation, boardRevision, retry, page])

  const deleted = model.writes.filter(
    (w) => w.action === 'delete' && w.targetTab === 'board',
  )

  const jobs = result?.data.rows

  if (error) {
    return (
      <AnimatedContent animationKey='error' className='space-y-3 p-3'>
        <p className='text-sm text-muted-foreground'>看板加载失败，请重试。</p>
        <Button
          variant='outline'
          size='sm'
          onClick={() => setRetry((value) => value + 1)}
        >
          重新加载
        </Button>
        {page > 0 && (
          <Button variant='ghost' size='sm' onClick={() => setPage(page - 1)}>
            上一页
          </Button>
        )}
      </AnimatedContent>
    )
  }

  if (!jobs || loadedGeneration !== generation) {
    return (
      <AnimatedContent animationKey='loading' className='p-3'>
        <Skeleton className='h-64 w-full' />
      </AnimatedContent>
    )
  }

  return (
    <AnimatedContent
      animationKey={jobs.length ? 'ready' : 'empty'}
      className='h-full min-h-0'
    >
      <ScrollArea className='h-full min-h-0'>
        <div className='p-3'>
          {jobs.length === 0 && (
            <p className='text-sm text-muted-foreground'>暂无职位。</p>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>公司</TableHead>
                <TableHead>岗位</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className='font-medium'>{job.company}</TableCell>
                  <TableCell>{job.position}</TableCell>
                  <TableCell>
                    <Badge variant='secondary'>
                      {STATUS_LABELS[job.status] ?? job.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {result && (result.page > 0 || result.data.hasMore) && (
            <nav
              aria-label='看板分页'
              aria-busy={page !== result.page}
              className='mt-3 flex items-center justify-end gap-2'
            >
              <Button
                variant='ghost'
                size='sm'
                disabled={page !== result.page || !result.page}
                onClick={() => setPage(result.page - 1)}
              >
                上一页
              </Button>
              <span className='text-xs text-muted-foreground'>
                第 {result.page + 1} 页
              </span>
              <Button
                variant='ghost'
                size='sm'
                disabled={page !== result.page || !result.data.hasMore}
                onClick={() => setPage(result.page + 1)}
              >
                下一页
              </Button>
            </nav>
          )}
          {deleted.length > 0 && (
            <p className='mt-3 text-xs text-muted-foreground'>
              本轮已删除：
              {deleted.map((d) => d.title).join('；')}
            </p>
          )}
        </div>
      </ScrollArea>
    </AnimatedContent>
  )
}
