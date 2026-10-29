import { useState } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION } from '@/lib/motion'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import useTrackerStore from '../../../store'

export default function JobDescription() {
  const job = useTrackerStore((state) => state.selectedJob)
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant='ghost'
            size='sm'
            className='h-6 px-1 text-xs'
            onClick={() => setOpen(true)}
          >
            查看 JD
          </Button>
        </DialogTrigger>
        <DialogContent
          style={{ animationDuration: `${reduce ? 0 : DURATION.base}s` }}
          overlayClassName={reduce ? 'animate-none!' : undefined}
          className='max-h-[80dvh] overflow-y-auto'
        >
          <DialogHeader>
            <DialogTitle>岗位 JD</DialogTitle>
            <DialogDescription>
              {job?.jd_updated_at
                ? `最近更新于 ${new Date(job.jd_updated_at).toLocaleString()}。投递记录保留各次投递时的副本。`
                : '可在编辑职位中补充 JD 原文和来源。'}
            </DialogDescription>
          </DialogHeader>
          <p className='whitespace-pre-wrap break-words text-sm'>
            {job?.jd_text || '尚未填写 JD 原文'}
          </p>
          {job?.source && (
            <p className='text-xs text-muted-foreground'>来源：{job.source}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
