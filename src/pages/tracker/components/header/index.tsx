import type { ApplicationStatus } from '../../types'
import { Archive, ArrowRightLeft, CheckSquare, Plus, Search, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { archiveCompany, deleteCompany, updateCompany } from '@/lib/supabase/resume'
import { cn } from '@/lib/utils'
import { APPLICATION_STATUS_CONFIG, APPLICATION_STATUS_ORDER, TRACKER_PRIMARY_ACTION_TEXT } from '../../const'
import useTrackerStore from '../../store'
import { appendStatusChangeActivity, autoCompleteStages, filterJobs, getTrackerErrorMessage } from '../../utils'
import FilterMenu from '../toolbar/filter-menu'
import SortMenu from '../toolbar/sort-menu'
import { ViewToggle } from './view-toggle'

export default function TrackerHeader() {
  const {
    jobs,
    loading,
    viewMode,
    isSelectMode,
    selectedIds,
    selectAll,
    enterSelectMode,
    exitSelectMode,
    removeJobs,
    syncJob,
    openAddDrawer,
    filterStatus,
    searchKeyword,
    setSearchKeyword,
    showArchived,
    setShowArchived,
  } = useTrackerStore()
  const [pendingBatchReject, setPendingBatchReject] = useState(false)
  const [pendingBatchDelete, setPendingBatchDelete] = useState(false)
  const jobCount = jobs.length
  const selectableCount = filterJobs(jobs, filterStatus, searchKeyword, showArchived).length
  const selectedCount = selectedIds.size

  const handleDeleteSelectedJobs = async () => {
    const { selectedIds: currentSelectedIds } = useTrackerStore.getState()
    if (currentSelectedIds.size === 0)
      return

    const ids = new Set(currentSelectedIds)

    try {
      await Promise.all(Array.from(ids).map(id => deleteCompany(id)))
      removeJobs(ids)
      toast.success(`已删除 ${ids.size} 个职位`)
    }
    catch (error) {
      console.error('Failed to delete jobs:', error)
      toast.error('删除失败', { description: getTrackerErrorMessage(error) })
    }
  }

  const runBatchStatusChange = async (newStatus: ApplicationStatus) => {
    const state = useTrackerStore.getState()
    const targets = state.jobs.filter(job => state.selectedIds.has(job.id) && job.status !== newStatus)
    if (targets.length === 0)
      return

    try {
      const saved = await Promise.all(targets.map((job) => {
        const stageDetails = autoCompleteStages(job.status, newStatus, job.stage_details, true)
        return updateCompany(job.id, {
          status: newStatus,
          stage_details: stageDetails,
          activities: appendStatusChangeActivity(job, newStatus),
        })
      }))
      saved.forEach(syncJob)
      exitSelectMode()
    }
    catch (error) {
      toast.error('批量更新失败', { description: getTrackerErrorMessage(error) })
    }
  }

  // 批量改到终态「已终止」需二次确认，与看板拖拽/抽屉单条路径一致
  const handleBatchStatusChange = (newStatus: ApplicationStatus) => {
    if (newStatus === 'rejected') {
      setPendingBatchReject(true)
      return
    }
    runBatchStatusChange(newStatus)
  }

  const handleBatchArchive = async () => {
    const state = useTrackerStore.getState()
    const targets = state.jobs.filter(job => state.selectedIds.has(job.id) && !job.archived)
    if (targets.length === 0)
      return

    try {
      const saved = await Promise.all(targets.map(job => archiveCompany(job.id, true)))
      saved.forEach(syncJob)
      exitSelectMode()
    }
    catch (error) {
      toast.error('批量归档失败', { description: getTrackerErrorMessage(error) })
    }
  }

  return (
    <>
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">求职跟进</h1>
            {loading
              ? <Skeleton className="h-4 w-16" />
              : (
                  <span className="text-sm text-muted-foreground">
                    共
                    <span className="mx-1 font-semibold text-foreground">{jobCount}</span>
                    个职位
                  </span>
                )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 lg:w-72 lg:flex-none">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={searchKeyword}
                placeholder="搜索公司 / 岗位 / 城市"
                className="pl-8"
                onChange={e => setSearchKeyword(e.target.value)}
              />
            </div>
            <FilterMenu />
            {viewMode === 'list' && <SortMenu />}
            <ViewToggle />
            <Button
              variant={showArchived ? 'secondary' : 'outline'}
              size="icon"
              aria-label={showArchived ? '隐藏已归档' : '显示已归档'}
              title={showArchived ? '隐藏已归档' : '显示已归档'}
              onClick={() => setShowArchived(!showArchived)}
            >
              <Archive />
            </Button>
            <Button
              variant={isSelectMode ? 'secondary' : 'outline'}
              size="icon"
              aria-label={isSelectMode ? '退出批量管理' : '批量管理'}
              title={isSelectMode ? '退出批量管理' : '批量管理'}
              onClick={isSelectMode ? exitSelectMode : enterSelectMode}
            >
              <CheckSquare />
            </Button>
            <Button onClick={openAddDrawer}>
              <Plus />
              {TRACKER_PRIMARY_ACTION_TEXT}
            </Button>
          </div>
        </div>

        {isSelectMode && (
          <div className={cn(
            'flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm',
            selectedCount > 0 && 'border-primary/40 bg-primary/5',
          )}
          >
            <span className="font-medium">
              已选
              <span className="mx-1 text-primary">{selectedCount}</span>
              /
              {' '}
              {selectableCount}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={selectAll}
            >
              {selectedCount === selectableCount && selectableCount > 0 ? '取消全选' : '全选当前筛选'}
            </Button>
            {selectedCount > 0 && (
              <div className="ml-auto flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 gap-1">
                      <ArrowRightLeft className="size-3.5" />
                      改状态
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {[...APPLICATION_STATUS_ORDER, 'rejected' as ApplicationStatus].map(status => (
                      <DropdownMenuItem key={status} onClick={() => handleBatchStatusChange(status)}>
                        标记为
                        {APPLICATION_STATUS_CONFIG[status].label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" className="h-7 gap-1" onClick={() => handleBatchArchive()}>
                  <Archive className="size-3.5" />
                  归档
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7"
                  onClick={() => setPendingBatchDelete(true)}
                >
                  <Trash2 />
                  删除选中
                </Button>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-7', selectedCount > 0 ? '' : 'ml-auto')}
              onClick={exitSelectMode}
            >
              <X />
              退出
            </Button>
          </div>
        )}
      </header>

      <AlertDialog open={pendingBatchReject} onOpenChange={open => !open && setPendingBatchReject(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量终止流程？</AlertDialogTitle>
            <AlertDialogDescription>
              将把选中的
              {' '}
              {selectedCount}
              {' '}
              个职位标记为「已终止」，可在「已终止」列或筛选下查看。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingBatchReject(false)}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setPendingBatchReject(false)
                runBatchStatusChange('rejected')
              }}
            >
              确认终止
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingBatchDelete} onOpenChange={open => !open && setPendingBatchDelete(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除选中的职位？</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除当前选中的
              {' '}
              {selectedCount}
              {' '}
              个职位，且无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingBatchDelete(false)}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setPendingBatchDelete(false)
                handleDeleteSelectedJobs()
              }}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
