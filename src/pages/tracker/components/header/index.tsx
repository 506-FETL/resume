import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TRACKER_PRIMARY_ACTION_TEXT } from '../../const'
import useTrackerStore from '../../store'
import ResponseRate from '../response-rate'

export default function TrackerHeader() {
  const openAddDrawer = useTrackerStore((state) => state.openAddDrawer)

  return (
    <header className='flex shrink-0 items-center justify-between gap-2'>
      <div className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-4'>
        <h1 className='text-xl leading-8 font-semibold tracking-tight sm:text-2xl'>
          求职跟进
        </h1>
        <ResponseRate />
      </div>
      <Button
        className='h-9 shrink-0 rounded-lg px-2.5 sm:px-3'
        onClick={openAddDrawer}
      >
        <Plus data-icon='inline-start' />
        <span className='hidden sm:inline'>{TRACKER_PRIMARY_ACTION_TEXT}</span>
        <span className='sm:hidden'>新增</span>
      </Button>
    </header>
  )
}
