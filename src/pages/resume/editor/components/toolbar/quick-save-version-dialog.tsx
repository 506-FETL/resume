import type { FormEvent } from 'react'
import { LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createResumeHistoryVersion,
  createResumeSnapshotHash,
  getResumeHistoryResume,
  listResumeHistoryVersions,
} from '@/lib/supabase/resume'
import { buildResumeSnapshot } from '@/pages/history/utils'

interface QuickSaveVersionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  resumeId: string
}

export function QuickSaveVersionDialog({ open, onOpenChange, resumeId }: QuickSaveVersionDialogProps) {
  const [versionName, setVersionName] = useState('')
  const [saving, setSaving] = useState(false)
  const isMountedRef = useRef(true)
  const savingRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && savingRef.current)
      return
    if (!nextOpen)
      setVersionName('')
    onOpenChange(nextOpen)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (savingRef.current)
      return

    savingRef.current = true
    setSaving(true)
    let completed = false

    try {
      const normalizedVersionName = versionName.trim()
      const record = await getResumeHistoryResume(resumeId)
      const snapshot = buildResumeSnapshot(record)
      const nextHash = await createResumeSnapshotHash(snapshot)

      // 与 /history 保存一致的去重：内容和最新版本一样就不重复存
      const versions = await listResumeHistoryVersions(resumeId)
      const latest = versions[0]
      if (latest?.content_hash && latest.content_hash === nextHash) {
        toast.info('内容没有变化，已是最新版本')
        completed = true
        return
      }

      await createResumeHistoryVersion({
        resume_id: resumeId,
        source_type: 'manual',
        snapshot,
        content_hash: nextHash,
        base_updated_at: record.updated_at,
        version_name: normalizedVersionName || null,
      })
      toast.success('当前版本已保存')
      completed = true
    }
    catch (error) {
      toast.error(error instanceof Error ? error.message : '保存版本失败')
    }
    finally {
      savingRef.current = false
      if (isMountedRef.current) {
        setSaving(false)
        if (completed) {
          setVersionName('')
          onOpenChange(false)
        }
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>快速保存版本</DialogTitle>
          <DialogDescription>为当前版本添加一个便于识别的名称，也可以留空。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-2 py-4">
            <Label htmlFor="quick-save-version-name">版本名称（可选）</Label>
            <Input
              id="quick-save-version-name"
              value={versionName}
              onChange={event => setVersionName(event.target.value)}
              placeholder="例如：项目优化版、字节投递版"
              maxLength={60}
              autoFocus
              disabled={saving}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
              取消
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <LoaderCircle className="animate-spin" data-icon="inline-start" />}
              {saving ? '保存中...' : '保存版本'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
