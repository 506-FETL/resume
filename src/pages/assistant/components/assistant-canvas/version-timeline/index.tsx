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
          <EmptyDescription>
            {isOfflineResume
              ? '请先将这份简历同步到云端，再保存、对比或恢复历史版本。'
              : '在「历史版本」页查看、对比与恢复所有版本。'}
          </EmptyDescription>
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
