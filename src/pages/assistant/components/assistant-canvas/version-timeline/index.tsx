import type { CanvasModel } from '../../../types'
import { History } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { isOfflineResumeId } from '@/lib/offline-resume-manager'
import useAssistantStore from '../../../store'

export default function VersionTimeline({ model: _model }: { model: CanvasModel }) {
  const previewResumeId = useAssistantStore(s => s.previewResumeId)
  const navigate = useNavigate()
  const isOfflineResume = Boolean(previewResumeId && isOfflineResumeId(previewResumeId))

  const openHistory = () => {
    navigate(previewResumeId ? `/history?resumeId=${previewResumeId}` : '/history')
  }

  return (
    <div className="flex h-full min-h-0 items-center justify-center p-6">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{isOfflineResume ? '本地简历暂无历史版本' : '版本已更新'}</EmptyTitle>
          {isOfflineResume && (
            <EmptyDescription>同步到云端后，才能保存、对比或恢复历史版本。</EmptyDescription>
          )}
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={openHistory} disabled={isOfflineResume}>
            <History data-icon="inline-start" />
            打开历史版本
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}
