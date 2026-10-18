import { Plus } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import useShareStore from '../../store'
import CreateDialog from '../create-dialog'

export default function Header() {
  const { resumeMap } = useShareStore()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const canCreate = Object.keys(resumeMap).length > 0

  return (
    <>
      <PageHeader
        title="分享管理"
        description="管理分享版本、访问权限与链接有效期。"
        actions={(
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
        )}
      />
      <CreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  )
}
