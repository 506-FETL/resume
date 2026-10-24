import type { CanvasModel } from '../../../types'
import type { ResumeType } from '@/lib/schema'
import { History, LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { isOfflineResumeId } from '@/lib/offline-resume-manager'
import { getResumeById } from '@/lib/supabase/resume'
import useCurrentResumeStore from '@/store/resume/current'
import useAssistantStore from '../../../store'

export default function VersionTimeline({
  model: _model,
}: {
  model: CanvasModel
}) {
  const previewResumeId = useAssistantStore((s) => s.previewResumeId)
  const setCurrentResume = useCurrentResumeStore((s) => s.setCurrentResume)
  const navigate = useNavigate()
  const [opening, setOpening] = useState(false)
  const requestIdRef = useRef(0)

  useEffect(() => {
    setOpening(false)

    return () => {
      requestIdRef.current += 1
    }
  }, [previewResumeId])

  const isOfflineResume = Boolean(
    previewResumeId && isOfflineResumeId(previewResumeId),
  )

  const openHistory = async () => {
    if (opening || isOfflineResume) return
    if (!previewResumeId) {
      navigate('/history')

      return
    }

    const requestId = ++requestIdRef.current

    setOpening(true)

    try {
      const resume = await getResumeById<{ type: ResumeType }>(
        previewResumeId,
        'type',
      )

      if (requestId !== requestIdRef.current) return

      setCurrentResume(previewResumeId, resume.type)
      navigate('/history')
    } catch (error) {
      if (requestId !== requestIdRef.current) return

      toast.error(error instanceof Error ? error.message : '打开历史版本失败')
    } finally {
      if (requestId === requestIdRef.current) setOpening(false)
    }
  }

  return (
    <div className='flex h-full min-h-0 items-center justify-center p-6'>
      <Empty>
        <EmptyHeader>
          <EmptyTitle>
            {isOfflineResume ? '本地简历暂无历史版本' : '版本已更新'}
          </EmptyTitle>
          {isOfflineResume && (
            <EmptyDescription>
              同步到云端后，才能保存、对比或恢复历史版本。
            </EmptyDescription>
          )}
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={openHistory} disabled={isOfflineResume || opening}>
            {opening ? (
              <LoaderCircle
                data-icon='inline-start'
                className='animate-spin motion-reduce:animate-none'
              />
            ) : (
              <History data-icon='inline-start' />
            )}
            {opening ? '正在打开…' : '打开历史版本'}
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}
