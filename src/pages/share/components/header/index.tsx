import { Plus } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import useShareStore from '../../store'
import CreateDialog from '../create-dialog'
import Overview from '../overview'

export default function Header() {
  const { resumeMap } = useShareStore()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const canCreate = Object.keys(resumeMap).length > 0

  return (
    <>
      <div className='space-y-2'>
        <PageHeader
          title='分享管理'
          actions={
            <Button
              className='h-9 shrink-0 px-3 text-xs sm:text-sm'
              data-share-dialog-fallback=''
              onClick={() => setCreateDialogOpen(true)}
              disabled={!canCreate}
              title={canCreate ? undefined : '请先创建或同步一份云端简历'}
            >
              <Plus data-icon='inline-start' />
              新建分享
            </Button>
          }
        />
        <Overview />
      </div>
      <CreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  )
}
