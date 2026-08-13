import type { FormEvent } from 'react'
import { LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createNextResumeVersion,
} from '@/lib/supabase/resume'
import useResumeStore from '@/store/resume/form'

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

  const notifyIfMounted = (notify: () => void) => {
    if (isMountedRef.current)
      notify()
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
      const resumeState = useResumeStore.getState()
      if (resumeState.pendingChanges) {
        await resumeState.manualSync()
        const synced = useResumeStore.getState()
        if (synced.pendingChanges || synced.syncError)
          throw new Error(synced.syncError ?? '简历尚未同步，无法创建新版本')
      }
      await createNextResumeVersion(resumeId, normalizedVersionName || null)
      window.dispatchEvent(new CustomEvent('resume-active-version-created', {
        detail: { resumeId },
      }))
      notifyIfMounted(() => toast.success('新版本已创建'))
      completed = true
    }
    catch (error) {
      notifyIfMounted(() => toast.error(error instanceof Error ? error.message : '保存版本失败'))
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
