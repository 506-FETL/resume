import type { CanvasModel } from '../../../types'
import type { JobApplication } from '@/pages/tracker/types'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getCompanies } from '@/lib/supabase/resume'

const STATUS_LABELS: Record<string, string> = {
  saved: '已保存',
  applied: '已投递',
  screen: '筛选中',
  interview: '面试中',
  offer: '已录用',
  rejected: '已终止',
}

export default function BoardSnapshot({ model }: { model: CanvasModel }) {
  const [jobs, setJobs] = useState<JobApplication[] | null>(null)

  // 仅统计「已应用」的看板写操作：awaiting-confirm 阶段刷新会读到旧数据，
  // 且确认后计数不变导致不再刷新（stale）。只在 result 时触发重新拉取。
  const boardWriteCount = model.writes.filter(w => w.category === 'board' && w.state === 'result').length
  useEffect(() => {
    getCompanies().then(setJobs).catch(() => setJobs([]))
  }, [boardWriteCount])

  const deleted = model.writes.filter(w => w.action === 'delete' && w.targetTab === 'board')

  if (!jobs) {
    return (
      <div className="p-3">
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="p-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>公司</TableHead>
              <TableHead>岗位</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map(job => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">{job.company}</TableCell>
                <TableCell>{job.position}</TableCell>
                <TableCell><Badge variant="secondary">{STATUS_LABELS[job.status] ?? job.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {deleted.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            本轮已删除：
            {deleted.map(d => d.title).join('；')}
          </p>
        )}
      </div>
    </ScrollArea>
  )
}
