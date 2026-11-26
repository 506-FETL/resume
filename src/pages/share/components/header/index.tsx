import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import useShareStore from '../../store'
import Overview from '../overview'

export default function Header() {
  const noResumes = useShareStore(
    (state) =>
      state.pageStats?.hasResumes === false && state.pageShares.length === 0,
  )

  const open = useShareStore((state) => state.setCreateDialogOpen)

  return (
    <div className='space-y-2'>
      <PageHeader
        title='分享管理'
        actions={
          <Button
            className='h-9 shrink-0 px-3 text-xs sm:text-sm'
            data-share-dialog-fallback=''
            onClick={() => open(true)}
            disabled={noResumes}
          >
            <Plus data-icon='inline-start' />
            新建分享
          </Button>
        }
      />
      <Overview />
    </div>
  )
}
