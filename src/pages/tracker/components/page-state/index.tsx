import {
  Archive,
  ArrowRight,
  BriefcaseBusiness,
  FilterX,
  Plus,
  RefreshCcw,
  SearchX,
  TriangleAlert,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { useTrackerFilterActions } from '../../hooks/use-tracker-filter-actions'
import useTrackerStore from '../../store'
import { selectTrackerListJobs } from '../../store/selectors'

interface TrackerPageStateProps {
  mode: 'empty' | 'archived' | 'filtered' | 'error'
  onRetry: () => void
}

export function TrackerPageState({ mode, onRetry }: TrackerPageStateProps) {
  const { error, openAddDrawer, jobs } = useTrackerStore(
    useShallow((state) => ({
      error: state.error,
      openAddDrawer: state.openAddDrawer,
      jobs: selectTrackerListJobs(state),
    })),
  )

  const { focusSearchInput, clearSearchAndFilters, setShowArchived } =
    useTrackerFilterActions()

  const hasArchived = jobs.some((job) => job.archived)

  const content = {
    empty: { icon: BriefcaseBusiness, title: '暂无职位', description: null },
    archived: { icon: Archive, title: '暂无归档职位', description: null },
    filtered: { icon: SearchX, title: '没有找到匹配的职位', description: null },
    error: {
      icon: TriangleAlert,
      title: '职位暂时无法加载',
      description: error || '请稍后重试。',
    },
  }[mode]

  const Icon = content.icon

  return (
    <div
      className='flex min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5'
      role={mode === 'error' ? 'alert' : 'status'}
    >
      <div className='m-auto flex max-w-sm shrink-0 flex-col items-center text-center'>
        <div className='mb-3 flex size-10 items-center justify-center rounded-xl border bg-background text-muted-foreground shadow-xs sm:mb-5 sm:size-14 sm:rounded-2xl'>
          <Icon className='size-5 sm:size-6' />
        </div>
        <h3 className='text-base font-semibold tracking-tight'>
          {content.title}
        </h3>
        {content.description && (
          <p className='mt-2 text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6'>
            {content.description}
          </p>
        )}
        <div className='mt-4 flex flex-wrap justify-center gap-2 sm:mt-6'>
          {mode === 'error' && (
            <Button
              variant='outline'
              onClick={() => {
                focusSearchInput()
                onRetry()
              }}
            >
              <RefreshCcw />
              重新加载
            </Button>
          )}
          {mode === 'filtered' && (
            <Button variant='outline' onClick={clearSearchAndFilters}>
              <FilterX />
              清除搜索与筛选
            </Button>
          )}
          {mode === 'archived' && (
            <Button variant='outline' onClick={() => setShowArchived(false)}>
              <ArrowRight />
              返回职位进展
            </Button>
          )}
          {mode === 'empty' && (
            <Button onClick={() => openAddDrawer()}>
              <Plus />
              新增职位
            </Button>
          )}
          {mode === 'empty' && hasArchived && (
            <Button variant='outline' onClick={() => setShowArchived(true)}>
              <Archive />
              查看已归档
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
