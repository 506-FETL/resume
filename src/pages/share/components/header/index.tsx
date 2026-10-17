import { Plus, Share2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import useShareStore from '../../store'
import CreateDialog from '../create-dialog'

export default function Header() {
  const { resumeMap } = useShareStore()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const canCreate = Object.keys(resumeMap).length > 0

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="hidden size-11 shrink-0 items-center justify-center rounded-2xl border bg-card shadow-xs sm:flex">
            <Share2 className="size-5 text-muted-foreground" />
          </div>
          <h1 className="min-w-0 text-2xl font-semibold tracking-tight">分享管理</h1>
        </div>
        <Button
          className="h-10 shrink-0 rounded-lg px-4"
          onClick={() => setCreateDialogOpen(true)}
          disabled={!canCreate}
          title={canCreate ? undefined : '请先创建或同步一份云端简历'}
        >
          <Plus data-icon="inline-start" />
          <span className="hidden sm:inline">新建分享</span>
          <span className="sm:hidden">新建</span>
        </Button>
      </div>
      <CreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  )
}
