import { Calendar, FileText } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import useResumeListStore from '@/pages/resume/store'
import { formatDate } from '@/utils/date'

export default function SyncResumesDialog() {
  const open = useResumeListStore(s => s.showSyncDialog)
  const setOpen = useResumeListStore(s => s.setShowSyncDialog)
  const rawOfflineResumes = useResumeListStore(s => s.offlineResumes)
  const isSyncing = useResumeListStore(s => s.isSyncing)
  const syncResumes = useResumeListStore(s => s.syncResumes)

  const offlineResumes = useMemo(() => rawOfflineResumes.map(r => ({
    resume_id: r.resume_id,
    display_name: r.display_name || '未命名简历',
    description: r.description,
    type: r.type,
    created_at: r.created_at,
  })), [rawOfflineResumes])

  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      setSelectedIds(prev => (prev.length ? prev : offlineResumes.map(r => r.resume_id)))
    }
    else {
      setSelectedIds([])
    }
  }, [open, offlineResumes])

  const handleToggle = (resumeId: string) => {
    setSelectedIds(prev => (prev.includes(resumeId) ? prev.filter(id => id !== resumeId) : [...prev, resumeId]))
  }

  const handleToggleAll = () => {
    if (selectedIds.length === offlineResumes.length) {
      setSelectedIds([])
    }
    else {
      setSelectedIds(offlineResumes.map(r => r.resume_id))
    }
  }

  const handleSync = async () => {
    if (selectedIds.length === 0)
      return
    await syncResumes(selectedIds)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-150">
        <DialogHeader>
          <DialogTitle className="text-2xl">同步本地简历到云端</DialogTitle>
          <DialogDescription>
            检测到
            {' '}
            <Badge variant="secondary">{offlineResumes.length}</Badge>
            {' '}
            个本地简历，选择需要同步到云端的简历
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* 全选按钮 */}
          <div className="flex items-center gap-2 border-b pb-2">
            <Checkbox
              id="select-all"
              checked={selectedIds.length === offlineResumes.length && offlineResumes.length > 0}
              onCheckedChange={handleToggleAll}
              disabled={isSyncing}
            />
            <label
              htmlFor="select-all"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              全选 (
              {selectedIds.length}
              /
              {offlineResumes.length}
              )
            </label>
          </div>

          {/* 简历列表 */}
          <ScrollArea className="h-100 pr-4">
            <div className="flex flex-col gap-3">
              {offlineResumes.map((resume) => {
                const isSelected = selectedIds.includes(resume.resume_id)
                return (
                  <Card
                    key={resume.resume_id}
                    className={`cursor-pointer transition-all ${
                      isSelected ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                    }`}
                    onClick={() => !isSyncing && handleToggle(resume.resume_id)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        <div onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggle(resume.resume_id)}
                            disabled={isSyncing}
                          />
                        </div>
                        <FileText className="size-5 text-primary mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base truncate">{resume.display_name}</CardTitle>
                          {resume.description && (
                            <CardDescription className="text-sm mt-1 line-clamp-2">
                              {resume.description}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 pl-12">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="size-3" />
                        <span>{formatDate(resume.created_at)}</span>
                        <Badge variant="outline" className="text-xs">
                          {resume.type}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <p className="text-sm text-muted-foreground">
            已选择
            {' '}
            <span className="font-semibold text-foreground">{selectedIds.length}</span>
            {' '}
            个简历
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSyncing}>
              稍后同步
            </Button>
            <Button onClick={handleSync} disabled={selectedIds.length === 0 || isSyncing}>
              {isSyncing ? '同步中...' : `同步 ${selectedIds.length} 个简历`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
