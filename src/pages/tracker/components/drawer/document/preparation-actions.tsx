import { useState } from 'react'
import {
  assertTrackerAccountScope,
  getTrackerAccountScope,
} from '../../../lib/account-scope'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { jobContextUrl } from '@/lib/job-context'
import useTrackerStore from '../../../store'

export default function PreparationActions() {
  const job = useTrackerStore((state) => state.selectedJob)
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  if (!job) return null

  const open = async (path: string, action?: string) => {
    if (busy) return

    const scope = getTrackerAccountScope()

    setBusy(true)

    try {
      await useTrackerStore.getState().flushWorkflow(job.id)
      assertTrackerAccountScope(scope)

      const latest = useTrackerStore.getState().selectedJob

      if (latest?.id !== job.id) return
      if (action === 'customize' && !latest.jd_text?.trim()) {
        toast.info('请先在岗位详情中补充 JD 原文')

        return
      }

      navigate(
        jobContextUrl(
          latest.resume_id ? path : '/resume',
          latest.id,
          action ? { action } : {},
        ),
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '岗位尚未保存，请重试',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='flex flex-wrap gap-2'>
      <Button disabled={busy} size='sm' onClick={() => open('/resume/editor')}>
        {job.resume_id ? '继续编辑' : '选择或创建简历'}
      </Button>
      <Button
        disabled={busy}
        size='sm'
        variant='outline'
        onClick={() => open('/resume', 'customize')}
      >
        岗位定制
      </Button>
      <Button
        disabled={busy}
        size='sm'
        variant='outline'
        onClick={() => open('/optimize')}
      >
        简历优化
      </Button>
      <Button
        disabled={busy}
        size='sm'
        variant='outline'
        onClick={() => open('/resume/editor', 'experience')}
      >
        相关经历
      </Button>
      <Button
        disabled={busy}
        size='sm'
        variant='outline'
        onClick={() => open('/history')}
      >
        历史版本
      </Button>
      <Button
        disabled={busy}
        size='sm'
        variant='outline'
        onClick={() => open('/resume', 'share')}
      >
        分享简历
      </Button>
    </div>
  )
}
