import { BriefcaseBusiness, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TRACKER_PRIMARY_ACTION_TEXT } from '../../const'
import useTrackerStore from '../../store'

export default function TrackerHeader() {
  const openAddDrawer = useTrackerStore(state => state.openAddDrawer)

  return (
    <header className="flex shrink-0 items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3.5">
        <div className="hidden size-11 shrink-0 items-center justify-center rounded-2xl border bg-card text-muted-foreground shadow-xs sm:flex">
          <BriefcaseBusiness className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">求职跟进</h1>
        </div>
      </div>
      <Button className="h-10 shrink-0 rounded-lg px-3 sm:px-4" onClick={openAddDrawer}>
        <Plus data-icon="inline-start" />
        <span className="hidden sm:inline">{TRACKER_PRIMARY_ACTION_TEXT}</span>
        <span className="sm:hidden">新增</span>
      </Button>
    </header>
  )
}
