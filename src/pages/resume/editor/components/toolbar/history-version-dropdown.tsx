import { History, LoaderCircle, Save } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useIsMobile } from '@/hooks/use-mobile'
import { isOfflineResumeId } from '@/lib/offline-resume-manager'
import {
  createResumeHistoryVersion,
  createResumeSnapshotHash,
  getResumeHistoryResume,
  listResumeHistoryVersions,
} from '@/lib/supabase/resume'
import { cn } from '@/lib/utils'
import { buildResumeSnapshot } from '@/pages/history/utils'
import useCurrentResumeStore from '@/store/resume/current'
import useResumeStore from '@/store/resume/form'

/**
 * 编辑器工具栏的历史版本入口：只保留「打开历史版本」（跳转 /history）与「快速保存」两个动作，
 * 完整的列表/预览/对比/恢复统一在 /history 页完成，避免维护多套版本 UI。
 */
export function ResumeHistoryVersionDropdown() {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const resumeId = useCurrentResumeStore(state => state.resumeId)
  const isInitialized = useResumeStore(state => state.isInitialized)
  const [saving, setSaving] = useState(false)

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

  const handleQuickSave = async () => {
    if (!canUseHistory || !resumeId || saving)
      return

    setSaving(true)
    try {
      const record = await getResumeHistoryResume(resumeId)
      const snapshot = buildResumeSnapshot(record)
      const nextHash = await createResumeSnapshotHash(snapshot)

      // 与 /history 保存一致的去重：内容和最新版本一样就不重复存
      const versions = await listResumeHistoryVersions(resumeId)
      const latest = versions[0]
      if (latest?.content_hash && latest.content_hash === nextHash) {
        toast.info('内容没有变化，已是最新版本')
        return
      }

      await createResumeHistoryVersion({
        resume_id: resumeId,
        source_type: 'manual',
        snapshot,
        content_hash: nextHash,
        base_updated_at: record.updated_at,
      })
      toast.success('当前版本已保存')
    }
    catch (error) {
      toast.error(error instanceof Error ? error.message : '保存版本失败')
    }
    finally {
      setSaving(false)
    }
  }

  return (
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
        <DropdownMenuItem disabled={saving} onClick={handleQuickSave}>
          {saving ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Save data-icon="inline-start" />}
          快速保存
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
