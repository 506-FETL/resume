import { History, Save } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useIsMobile } from '@/hooks/use-mobile'
import { isOfflineResumeId } from '@/lib/offline-resume-manager'
import { cn } from '@/lib/utils'
import useCurrentResumeStore from '@/store/resume/current'
import useResumeStore from '@/store/resume/form'
import { QuickSaveVersionDialog } from './quick-save-version-dialog'

/**
 * 编辑器工具栏的历史版本入口：只保留「打开历史版本」（跳转 /history）与「快速保存」两个动作，
 * 完整的列表/预览/对比/恢复统一在 /history 页完成，避免维护多套版本 UI。
 */
export function ResumeHistoryVersionDropdown() {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const resumeId = useCurrentResumeStore(state => state.resumeId)
  const isInitialized = useResumeStore(state => state.isInitialized)
  const [quickSaveOpen, setQuickSaveOpen] = useState(false)

  const isOffline = Boolean(resumeId) && isOfflineResumeId(resumeId!)
  const canUseHistory = Boolean(resumeId) && !isOffline && isInitialized

  const disabledReason = !resumeId
    ? '当前未选择简历'
    : isOffline
      ? '离线简历暂不支持历史版本'
      : undefined

  const openHistory = () => {
    if (!canUseHistory || !resumeId)
      return
    navigate(`/history?resumeId=${resumeId}`)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size={isMobile ? 'icon' : 'sm'}
            className={cn(isMobile && 'size-9')}
            disabled={!canUseHistory}
            title={disabledReason}
          >
            <History data-icon="inline-start" />
            {!isMobile && <span>历史版本</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom" className="w-44">
          <DropdownMenuItem onClick={openHistory}>
            <History data-icon="inline-start" />
            查看历史版本
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setQuickSaveOpen(true)}>
            <Save data-icon="inline-start" />
            快速保存
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {canUseHistory && resumeId && (
        <QuickSaveVersionDialog
          open={quickSaveOpen}
          onOpenChange={setQuickSaveOpen}
          resumeId={resumeId}
        />
      )}
    </>
  )
}
