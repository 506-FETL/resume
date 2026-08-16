import type { CSSProperties } from 'react'
import type { ApplicationStatus, DrawerTab } from '../../types'
import { Archive, ArrowLeft, ArrowRight, BriefcaseBusiness, MoreHorizontal, Pencil, Trash2, XCircle } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useIsMobile } from '@/hooks/use-mobile'
import { archiveCompany, deleteCompany, updateCompany } from '@/lib/supabase/resume'
import { cn } from '@/lib/utils'
import { APPLICATION_STATUS_CONFIG, APPLICATION_STATUS_ORDER } from '../../const'
import useTrackerStore from '../../store'
import { appendStatusChangeActivity, autoCompleteStages, getTrackerErrorMessage, getTrackerNextAction } from '../../utils'
import { CompanyLogo } from '../company-logo'
import ActivityTimeline from './activity-timeline'
import Contacts from './contacts'
import DrawerDocument from './document'
import DrawerEditForm from './edit-form'
import DrawerMetaBar from './meta-bar'
import NextActionSection from './next-action'
import ProgressTimeline from './progress-timeline'
import DrawerStageDetail from './stage-detail'

type ConfirmKind = 'reject' | 'delete' | 'jump-offer' | null
const DRAWER_TAB_TRIGGER_CLASS = 'h-10 flex-1 rounded-none border-x-0 border-t-0 border-b-2 border-transparent after:hidden data-[state=active]:border-foreground'

export default function JobDrawer() {
  const { selectedJob, drawerOpen, closeJobDrawer, syncJob, restoreJobsSnapshot, removeJobs } = useTrackerStore()
  const isMobile = useIsMobile()
  const reduce = useReducedMotion()
  const [activeTab, setActiveTab] = useState<DrawerTab>('follow-up')
  const [isEditing, setIsEditing] = useState(false)
  const [viewingStage, setViewingStage] = useState<ApplicationStatus | null>(null)
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null)

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setActiveTab('follow-up')
      setIsEditing(false)
      setViewingStage(null)
      closeJobDrawer()
    }
  }

  const handleSaved = () => setIsEditing(false)

  const handleProgressChange = (newStatus: ApplicationStatus) => {
    if (!selectedJob)
      return

    const previousState = useTrackerStore.getState()
    const updatedStageDetails = autoCompleteStages(selectedJob.status, newStatus, selectedJob.stage_details, true)
    const optimisticJob = {
      ...selectedJob,
      status: newStatus,
      stage_details: updatedStageDetails,
      activities: appendStatusChangeActivity(selectedJob, newStatus),
    }

    syncJob(optimisticJob)

    updateCompany(selectedJob.id, optimisticJob)
      .then(syncJob)
      .catch((error) => {
        restoreJobsSnapshot({
          jobs: previousState.jobs,
          selectedJob: previousState.selectedJob,
        })
        toast.error('更新失败', { description: getTrackerErrorMessage(error) })
      })

    setViewingStage(null)
  }

  // 进度时间线点击跳转：终态(offer)二次确认，其余直接推进/回退
  const handleStageJump = (target: ApplicationStatus) => {
    if (!selectedJob || target === selectedJob.status)
      return
    if (target === 'offer') {
      setConfirmKind('jump-offer')
      return
    }
    handleProgressChange(target)
  }

  const handleStepBack = () => {
    if (!selectedJob)
      return
    const idx = APPLICATION_STATUS_ORDER.indexOf(selectedJob.status)
    if (idx > 0)
      handleProgressChange(APPLICATION_STATUS_ORDER[idx - 1])
  }

  const handleReject = () => {
    if (!selectedJob || selectedJob.status === 'rejected')
      return
    handleProgressChange('rejected')
    setConfirmKind(null)
  }

  const handleDelete = async () => {
    if (!selectedJob)
      return
    setConfirmKind(null)
    try {
      await deleteCompany(selectedJob.id)
      removeJobs([selectedJob.id])
      toast.success('已删除该职位')
    }
    catch (error) {
      toast.error('删除失败', { description: getTrackerErrorMessage(error) })
    }
  }

  const handleArchive = async () => {
    if (!selectedJob)
      return
    const next = !selectedJob.archived
    try {
      const savedJob = await archiveCompany(selectedJob.id, next)
      syncJob(savedJob)
    }
    catch (error) {
      toast.error('操作失败', { description: getTrackerErrorMessage(error) })
    }
  }

  if (!selectedJob) {
    return (
      <>
        <Drawer
          open={false}
          onOpenChange={handleOpenChange}
          swipeDirection={isMobile ? 'down' : 'right'}
          showSwipeHandle={isMobile}
        />
      </>
    )
  }

  const statusConfig = APPLICATION_STATUS_CONFIG[selectedJob.status]
  const displayStage = viewingStage || selectedJob.status
  const isViewingHistory = viewingStage !== null && viewingStage !== selectedJob.status
  const canStepBack = APPLICATION_STATUS_ORDER.indexOf(selectedJob.status) > 0 && selectedJob.status !== 'rejected'

  const titleBlock = (
    <div className={cn('flex items-start', isMobile ? 'gap-2.5' : 'gap-3')}>
      <div className={cn('flex shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary', isMobile ? 'size-10' : 'size-11')}>
        <CompanyLogo
          logo={selectedJob.company_logo}
          company={selectedJob.company}
          icon={BriefcaseBusiness}
          imgClassName={isMobile ? 'size-6' : 'size-7'}
          iconClassName={isMobile ? 'size-4.5' : 'size-5'}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2 text-xs">
          <Badge className={cn('rounded-full border-0 px-2 py-0.5 text-[11px] font-medium', statusConfig.bgColor, statusConfig.color)}>
            {statusConfig.label}
          </Badge>
          <span className="truncate text-muted-foreground">{selectedJob.company}</span>
        </div>
        <DrawerTitle className={cn('line-clamp-1 leading-tight tracking-tight', isMobile ? 'text-base' : 'text-lg')}>{selectedJob.position}</DrawerTitle>
      </div>
    </div>
  )

  const nextAction = getTrackerNextAction(selectedJob)

  const actionMenu = (includeEdit: boolean) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={includeEdit ? 'outline' : 'ghost'}
          size={includeEdit ? 'icon' : 'icon-sm'}
          aria-label="更多操作"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {includeEdit && (
          <DropdownMenuItem onClick={() => setIsEditing(true)}>
            <Pencil className="size-4" />
            编辑信息
          </DropdownMenuItem>
        )}
        {includeEdit && <DropdownMenuSeparator />}
        <DropdownMenuItem disabled={!canStepBack} onClick={handleStepBack}>
          <ArrowLeft className="size-4" />
          回退到上一阶段
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={selectedJob.status === 'rejected'}
          onClick={() => setConfirmKind('reject')}
          className="text-destructive focus:text-destructive"
        >
          <XCircle className="size-4" />
          终止该流程
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleArchive}>
          <Archive className="size-4" />
          {selectedJob.archived ? '取消归档' : '归档'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setConfirmKind('delete')} className="text-destructive focus:text-destructive">
          <Trash2 className="size-4" />
          删除该记录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const desktopToolbar = !isEditing && (
    <div className="flex items-center gap-1">
      {nextAction.targetStatus && (
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => handleStageJump(nextAction.targetStatus!)}
        >
          {nextAction.label}
          <ArrowRight className="size-3.5" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 px-2 text-xs sm:px-3"
        aria-label="编辑信息"
        onClick={() => setIsEditing(true)}
      >
        <Pencil className="size-3.5" />
        <span className="hidden sm:inline">编辑信息</span>
      </Button>
      {actionMenu(false)}
    </div>
  )

  const handlePrimaryAction = () => {
    if (nextAction.targetStatus) {
      handleStageJump(nextAction.targetStatus)
      return
    }

    setIsEditing(false)
    setActiveTab(selectedJob.status === 'interview' ? 'interview' : 'follow-up')
  }

  const headerContent = (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        {titleBlock}
        <div className="flex shrink-0 items-center gap-1">
          {!isMobile && desktopToolbar}
        </div>
      </div>
      <DrawerMetaBar />
    </div>
  )

  const body = (
    <div className="scrollbar-gutter-stable scrollbar-thin-subtle min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className={cn(isMobile ? 'px-4 py-4' : 'px-5 py-5 lg:px-6')}>
        {isEditing
          ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">编辑职位信息</h3>
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                    <ArrowLeft className="size-4" />
                    返回
                  </Button>
                </div>
                <DrawerEditForm onSaved={handleSaved} onCancel={() => setIsEditing(false)} />
              </div>
            )
          : (
              <Tabs value={activeTab} onValueChange={v => setActiveTab(v as DrawerTab)}>
                <TabsList
                  variant="line"
                  className="sticky top-0 z-20 w-full rounded-none border-b bg-popover p-0 shadow-[0_6px_10px_-10px_rgba(0,0,0,0.45)]"
                >
                  <TabsTrigger value="follow-up" className={DRAWER_TAB_TRIGGER_CLASS}>跟进</TabsTrigger>
                  <TabsTrigger value="interview" className={DRAWER_TAB_TRIGGER_CLASS}>阶段详情</TabsTrigger>
                  <TabsTrigger value="documents" className={DRAWER_TAB_TRIGGER_CLASS}>简历 & 联系人</TabsTrigger>
                </TabsList>

                <TabsContent value="follow-up" className="mt-5">
                  <motion.div
                    initial={reduce ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    {selectedJob.status !== 'rejected' && <NextActionSection key={selectedJob.id} job={selectedJob} />}
                    <ProgressTimeline
                      viewingStage={viewingStage}
                      onStageClick={stage => setViewingStage(stage === selectedJob.status ? null : stage)}
                      onStageJump={handleStageJump}
                    />
                    <Separator />
                    <ActivityTimeline job={selectedJob} />
                  </motion.div>
                </TabsContent>

                <TabsContent value="interview" className="mt-5">
                  <motion.div
                    initial={reduce ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    {selectedJob.status === 'rejected'
                      ? (
                          <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-8 text-center text-sm text-muted-foreground">
                            该流程已终止，阶段详情不可再编辑。
                          </p>
                        )
                      : (
                          <DrawerStageDetail
                            displayStage={displayStage}
                            isViewingHistory={isViewingHistory}
                            onSaved={() => setViewingStage(null)}
                          />
                        )}
                  </motion.div>
                </TabsContent>

                <TabsContent value="documents" className="mt-5">
                  <motion.div
                    initial={reduce ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    <DrawerDocument />
                    <Separator />
                    <Contacts job={selectedJob} />
                  </motion.div>
                </TabsContent>
              </Tabs>
            )}
      </div>
    </div>
  )

  const confirmDialog = (
    <AlertDialog open={confirmKind !== null} onOpenChange={open => !open && setConfirmKind(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {confirmKind === 'delete'
              ? '确认删除该记录？'
              : confirmKind === 'jump-offer'
                ? '确认移动到「已录用」？'
                : '确认终止该流程？'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {confirmKind === 'delete'
              ? `「${selectedJob.company} - ${selectedJob.position}」将被永久删除，无法恢复。`
              : confirmKind === 'jump-offer'
                ? '将把该职位标记为已录用。'
                : '该操作会把状态标记为「终止流程」，可在「已终止」筛选下查看。'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            className={cn(confirmKind !== 'jump-offer' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
            onClick={() => {
              if (confirmKind === 'delete')
                handleDelete()
              else if (confirmKind === 'reject')
                handleReject()
              else if (confirmKind === 'jump-offer')
                handleProgressChange('offer')
            }}
          >
            {confirmKind === 'delete' ? '删除' : confirmKind === 'jump-offer' ? '确认' : '终止'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  const mobileFooter = isMobile && !isEditing && (
    <div className="flex shrink-0 items-center gap-2 border-t bg-popover px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
      {actionMenu(true)}
      <Button className="min-w-0 flex-1" onClick={handlePrimaryAction}>
        <span className="truncate">{nextAction.label}</span>
        <ArrowRight className="size-4" />
      </Button>
    </div>
  )

  return (
    <>
      <Drawer
        open={drawerOpen}
        onOpenChange={handleOpenChange}
        swipeDirection={isMobile ? 'down' : 'right'}
        showSwipeHandle={isMobile}
      >
        <DrawerContent
          className="flex min-h-0 flex-col gap-0 overflow-hidden p-0"
          style={isMobile
            ? undefined
            : {
                '--drawer-content-height': 'calc(100dvh - 1rem)',
                '--drawer-content-max-height': 'none',
                '--drawer-content-width': 'min(40vw, 56rem)',
              } as CSSProperties}
        >
          <DrawerHeader
            className={cn(
              'shrink-0 text-left',
              isMobile ? 'px-4 py-3' : 'px-5 py-4 lg:px-6',
            )}
          >
            {headerContent}
            <DrawerDescription className="sr-only">{selectedJob.company}</DrawerDescription>
          </DrawerHeader>
          <Separator />
          {body}
          {mobileFooter}
        </DrawerContent>
      </Drawer>
      {confirmDialog}
    </>
  )
}
