import { useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { BoardView } from './components/board-view'
import { AddJobDrawer, JobDrawer } from './components/drawer'
import { JobCard } from './components/job-card'
import { ViewToggle } from './components/view-toggle'
import useTrackerStore from './store'

function Tracker() {
  const {
    jobs,
    viewMode,
    setViewMode,
    selectedJob,
    drawerOpen,
    closeDrawer,
    addDrawerOpen,
    setAddDrawerOpen,
    selectedIds,
    isSelectMode,
    init,
    updateJobStatus,
    addJob,
    deleteSelectedJobs,
    openDrawer,
    updateJob,
    enterSelectMode,
    exitSelectMode,
    toggleSelect,
    selectAll,
  } = useTrackerStore()

  useEffect(() => {
    init()
  }, [init])

  return (
    <>
      <div className="flex flex-col gap-6 p-4 md:p-8 w-full max-w-7xl mx-auto overflow-x-hidden">
        {/* 标题区域 */}
        <header>
          <h1 className="text-2xl font-bold">你的求职跟进</h1>
          <p className="text-muted-foreground">
            共
            {' '}
            {jobs.length}
            {' '}
            个职位，跟踪你的求职投递状态
          </p>
        </header>

        {/* 操作栏：按钮+视图切换 */}
        <div className="flex items-center gap-2">
          {/* Manage Jobs 按钮 / N Jobs Selected */}
          {isSelectMode
            ? (
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'gap-2',
                    selectedIds.size > 0 && 'border-primary bg-primary/10 text-primary',
                  )}
                  onClick={selectAll}
                >
                  <Checkbox
                    checked={selectedIds.size === jobs.length && jobs.length > 0}
                    className="size-4"
                  />
                  {selectedIds.size}
                  {' '}
                  Jobs Selected
                </Button>
              )
            : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={enterSelectMode}
                >
                  Manage Jobs
                </Button>
              )}
          {/* 竖线分隔符 */}
          <div className="h-6 w-px bg-border" />
          {/* 新建 + 导入 */}
          <Button onClick={() => setAddDrawerOpen(true)}>新建看板</Button>
          <Button variant="outline" onClick={() => toast.warning('功能开发中')}>
            导入简历
          </Button>
          {/* 选择模式下显示：Delete + Done */}
          {isSelectMode && (
            <>
              {selectedIds.size > 0 && (
                <Button variant="destructive" size="sm" onClick={deleteSelectedJobs}>
                  Delete
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={exitSelectMode}>
                × Done
              </Button>
            </>
          )}
          {/* 视图切换 */}
          <div className="ml-auto">
            <ViewToggle value={viewMode} onModeChange={setViewMode} />
          </div>
        </div>

        {/* 主模块区域 - 根据视图渲染 */}
        <main className="w-full overflow-hidden">
          {viewMode === 'list'
            ? (
                <div className="flex flex-col gap-4">
                  {jobs.map(job => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onStatusChange={updateJobStatus}
                      onJobClick={openDrawer}
                      isSelectMode={isSelectMode}
                      isSelected={selectedIds.has(job.id)}
                      onToggleSelect={toggleSelect}
                    />
                  ))}
                </div>
              )
            : (
                <BoardView
                  jobs={jobs}
                  onStatusChange={updateJobStatus}
                  onJobClick={openDrawer}
                  isSelectMode={isSelectMode}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                />
              )}
        </main>
      </div>

      <JobDrawer
        job={selectedJob}
        open={drawerOpen}
        onOpenChange={open => !open && closeDrawer()}
        onStatusChange={updateJobStatus}
        onJobUpdate={updateJob}
      />

      <AddJobDrawer
        open={addDrawerOpen}
        onOpenChange={setAddDrawerOpen}
        onAdd={addJob}
      />
    </>
  )
}

export default Tracker
