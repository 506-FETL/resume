import { Button } from '@/components/ui/button'

import { useReducedMotion } from '@/hooks/use-reduced-motion'

import { DURATION, EASE } from '@/lib/motion'
import { Check, FileText, X } from 'lucide-react'
import { motion } from 'motion/react'

import type { Dispatch, SetStateAction } from 'react'
import type { UploadJob } from '../types'

export function UploadJobList({
  jobs,
  saving,
  setJobs,
}: {
  jobs: UploadJob[]
  saving: boolean
  setJobs: Dispatch<SetStateAction<UploadJob[]>>
}) {
  const reduced = useReducedMotion()

  return (
    <div className='mt-4 space-y-2' aria-live='polite'>
      {jobs.map((job, index) => (
        <motion.div
          key={job.operationId}
          initial={{ opacity: 0, y: reduced ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduced ? 0 : DURATION.base,
            ease: EASE.out,
            delay: reduced ? 0 : Math.min(index, 5) * 0.03,
          }}
          className='flex items-start gap-3 rounded-lg bg-muted/30 p-3'
        >
          <div className='pt-0.5'>
            {job.status === 'ready' ? (
              <Check className='size-4 text-primary' />
            ) : (
              <FileText className='size-4 text-muted-foreground' />
            )}
          </div>
          <div className='min-w-0 flex-1'>
            <p className='wrap-break-word text-sm font-medium'>{job.name}</p>
            <p
              className={
                job.status === 'failed' || job.status === 'unknown'
                  ? 'text-xs text-destructive'
                  : 'text-xs text-muted-foreground'
              }
            >
              {
                {
                  queued: '待保存',
                  reading: '正在准备资料',
                  saving: '正在保存资料',
                  ready: '已保存',
                  failed: job.error,
                  unknown: job.error,
                  cancelled: '已停止，尚未保存',
                }[job.status]
              }
            </p>
          </div>
          {job.status === 'reading' && (
            <Button
              size='icon-sm'
              variant='ghost'
              aria-label={`停止保存${job.name}`}
              onClick={() => job.controller.abort()}
            >
              <X />
            </Button>
          )}
          {!saving && job.status !== 'ready' && job.status !== 'unknown' && (
            <Button
              size='icon-sm'
              variant='ghost'
              aria-label={`移除${job.name}`}
              onClick={() =>
                setJobs((current) =>
                  current.filter(
                    (item) => item.operationId !== job.operationId,
                  ),
                )
              }
            >
              <X />
            </Button>
          )}
        </motion.div>
      ))}
    </div>
  )
}
