import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { TRACKER_PRIMARY_ACTION_TEXT } from '../../const'
import useTrackerStore from '../../store'

export default function TrackerHeader() {
  const openAddDrawer = useTrackerStore((state) => state.openAddDrawer)

  return (
    <PageHeader
      title='求职跟进'
      actions={
        <Button
          className='h-10 shrink-0 rounded-lg px-3 sm:px-4'
          onClick={openAddDrawer}
        >
          <Plus data-icon='inline-start' />
          <span className='hidden sm:inline'>
            {TRACKER_PRIMARY_ACTION_TEXT}
          </span>
          <span className='sm:hidden'>新增</span>
        </Button>
      }
    />
  )
}
