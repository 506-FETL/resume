import { Plus, Share2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import useShareStore from '../../store'
import { deriveShareStatus } from '../../utils'
import CreateDialog from '../create-dialog'

export default function Header() {
  const { allShares, resumeMap } = useShareStore()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const activeCount = allShares.filter(
    share => deriveShareStatus(share) === 'active',
  ).length
  const canCreate = Object.keys(resumeMap).length > 0

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <Share2 className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">分享管理</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {allShares.length}
              {' '}
              个链接 ·
              {' '}
              {activeCount}
              {' '}
              个有效
            </p>
          </div>
        </div>
        <Button
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
