import type { ComponentProps, CSSProperties } from 'react'
import type { ApplicationStatus, DrawerTab } from '../../types'
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  memo,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useIsMobile } from '@/hooks/use-mobile'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import {
  APPLICATION_STATUS_CONFIG,
  APPLICATION_STATUS_ORDER,
  TRACKER_SEARCH_INPUT_ID,
} from '../../const'
import { isTrackerAccountScopeError } from '../../lib/account-scope'
import useTrackerStore from '../../store'
import { selectTrackerDrawerJob } from '../../store/selectors'
import { getTrackerErrorMessage, getTrackerNextAction } from '../../utils'
import { CompanyLogo } from '../company-logo'
import ViewTransition from '../view-transition'
import ActivityTimeline from './activity-timeline'
import Contacts from './contacts'
import DrawerDocument from './document/index'
import DrawerEditForm from './edit-form'
import DrawerMetaBar from './meta-bar'
import NextActionSection from './next-action'
import ProgressTimeline from './progress-timeline/index'
import DrawerStageDetail from './stage-detail/index'
import DrawerTabPanel from './tab-panel'

type ConfirmKind = 'reject' | 'delete' | 'jump-offer' | null

const DRAWER_TABS: { value: DrawerTab; label: string }[] = [
  { value: 'follow-up', label: '跟进' },
  { value: 'interview', label: '阶段详情' },
  { value: 'documents', label: '联系人与简历' },
]

function JobDrawer() {
  const {
    selectedJob,
    drawerOpen,
    closeJobDrawer,
    changeJobStatus,
    saveJobFields,
    deleteJob,
    flushWorkflow,
  } = useTrackerStore(
    useShallow((state) => ({
      selectedJob: selectTrackerDrawerJob(state),
      drawerOpen: state.drawerOpen,
      closeJobDrawer: state.closeJobDrawer,
      changeJobStatus: state.changeJobStatus,
      saveJobFields: state.saveJobFields,
      deleteJob: state.deleteJob,
      flushWorkflow: state.flushWorkflow,
    })),
  )

  const isMobile = useIsMobile()
  const reduce = useReducedMotion()
  const underlineId = useId()
  const [activeTab, setActiveTab] = useState<DrawerTab>('follow-up')
  const [isEditing, setIsEditing] = useState(false)

  const [viewingStage, setViewingStage] = useState<ApplicationStatus | null>(
    null,
  )

  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null)
  const [resumeOpen, setResumeOpen] = useState(false)
  const confirmTriggerRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const drawerTriggerRef = useRef<HTMLElement | null>(null)
  const tabElementsRef = useRef(new Map<DrawerTab, HTMLButtonElement>())

  const setCloseButtonRef = useCallback(
    (element: HTMLButtonElement | null) => {
      closeButtonRef.current = element

      if (!element || !drawerOpen) return

      const focused = document.activeElement
      const popup = element.closest('[data-slot="drawer-popup"]')

      if (focused instanceof HTMLElement && !popup?.contains(focused))
        drawerTriggerRef.current =
          focused === document.body || focused === document.documentElement
            ? null
            : focused

      // Portal 可能晚于父组件 effect 挂载，在节点就绪时先交接焦点再隐藏背景。
      element.focus({ preventScroll: true })
    },
    [drawerOpen],
  )

  useLayoutEffect(() => {
    if (!drawerOpen) return

    setActiveTab('follow-up')
    setIsEditing(false)
    setViewingStage(null)
    setResumeOpen(false)
    setConfirmKind(null)
  }, [selectedJob?.id, drawerOpen])

  const handleOpenChange = (
    newOpen: boolean,
    details?: Parameters<
      NonNullable<ComponentProps<typeof Drawer>['onOpenChange']>
    >[1],
  ) => {
    // Radix 浮层独立于 Base UI 的浮层树，Esc 只关闭当前确认框、选择器或日历。
    if (
      !newOpen &&
      details?.reason === 'escape-key' &&
      details.event.target instanceof Element &&
      details.event.target.closest(
        '[role="alertdialog"], [role="listbox"], [role="menu"], [data-slot="popover-content"]',
      )
    ) {
      details.cancel()

      return
    }
    if (!newOpen) {
      closeJobDrawer()
    }
  }

  const handleSaved = () => setIsEditing(false)

  const handleProgressChange = (newStatus: ApplicationStatus) => {
    if (!selectedJob) return

    changeJobStatus(selectedJob.id, newStatus).catch((error) => {
      if (!isTrackerAccountScopeError(error))
        toast.error('更新失败', { description: getTrackerErrorMessage(error) })
    })

    setViewingStage(null)
  }

  // 节点沿用推进/回退入口；两个互斥终态都需明确确认。
  const handleStageJump = (target: ApplicationStatus) => {
    if (!selectedJob || target === selectedJob.status) return
    if (target === 'offer') {
      setConfirmKind('jump-offer')

      return
    }
    if (target === 'rejected') {
      setConfirmKind('reject')

      return
    }

    handleProgressChange(target)
  }

  const handleStepBack = () => {
    if (!selectedJob) return

    const idx = APPLICATION_STATUS_ORDER.indexOf(selectedJob.status)

    if (idx > 0) handleProgressChange(APPLICATION_STATUS_ORDER[idx - 1])
  }

  const handleReject = () => {
    if (!selectedJob || selectedJob.status === 'rejected') return

    handleProgressChange('rejected')
    setConfirmKind(null)
  }

  const handleDelete = async () => {
    if (!selectedJob) return

    setConfirmKind(null)

    try {
      await deleteJob(selectedJob.id)
      toast.success('已删除该职位')
    } catch (error) {
      if (isTrackerAccountScopeError(error)) return

      toast.error('删除失败', { description: getTrackerErrorMessage(error) })
    }
  }

  const handleArchive = async () => {
    if (!selectedJob) return

    const next = !selectedJob.archived

    try {
      await saveJobFields(selectedJob.id, { archived: next })
    } catch (error) {
      if (isTrackerAccountScopeError(error)) return

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

  const canStepBack =
    APPLICATION_STATUS_ORDER.indexOf(selectedJob.status) > 0 &&
    selectedJob.status !== 'rejected'

  const titleBlock = (
    <div className={cn('flex items-start', isMobile ? 'gap-2.5' : 'gap-3')}>
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary',
          isMobile ? 'size-10' : 'size-11',
        )}
      >
        <CompanyLogo
          logo={selectedJob.company_logo}
          company={selectedJob.company}
          icon={BriefcaseBusiness}
          imgClassName={isMobile ? 'size-6' : 'size-7'}
          iconClassName={isMobile ? 'size-4.5' : 'size-5'}
        />
      </div>
      <div className='flex min-w-0 flex-1 flex-col gap-1'>
        <div className='flex items-center gap-2 text-xs'>
          <Badge
            className={cn(
              'rounded-full border-0 px-2 py-0.5 text-[11px] font-medium',
              statusConfig.bgColor,
              statusConfig.color,
            )}
          >
            {statusConfig.label}
          </Badge>
          <span className='truncate text-muted-foreground'>
            {selectedJob.company}
          </span>
        </div>
        <DrawerTitle
          className={cn(
            'line-clamp-1 leading-tight tracking-tight',
            isMobile ? 'text-base' : 'text-lg',
          )}
        >
          {selectedJob.position}
        </DrawerTitle>
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
          aria-label='更多操作'
        >
          <MoreHorizontal className='size-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-44'>
        {includeEdit && (
          <DropdownMenuItem onClick={() => setIsEditing(true)}>
            <Pencil className='size-4' />
            编辑信息
          </DropdownMenuItem>
        )}
        {includeEdit && <DropdownMenuSeparator />}
        <DropdownMenuItem disabled={!canStepBack} onClick={handleStepBack}>
          <ArrowLeft className='size-4' />
          回退到上一阶段
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={selectedJob.status === 'rejected'}
          onClick={() => setConfirmKind('reject')}
          className='text-destructive focus:text-destructive'
        >
          <XCircle className='size-4' />
          结束该流程
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleArchive}>
          <Archive className='size-4' />
          {selectedJob.archived ? '取消归档' : '归档'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setConfirmKind('delete')}
          className='text-destructive focus:text-destructive'
        >
          <Trash2 className='size-4' />
          删除该记录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const desktopToolbar = !isEditing && (
    <div className='flex items-center gap-1'>
      {nextAction.targetStatus && (
        <Button
          size='sm'
          className='h-8 gap-1.5 text-xs'
          onClick={() => handleStageJump(nextAction.targetStatus!)}
        >
          {nextAction.label}
          <ArrowRight className='size-3.5' />
        </Button>
      )}
      <Button
        variant='ghost'
        size='sm'
        className='h-8 gap-1.5 px-2 text-xs sm:px-3'
        aria-label='编辑信息'
        onClick={() => setIsEditing(true)}
      >
        <Pencil className='size-3.5' />
        <span className='hidden sm:inline'>编辑信息</span>
      </Button>
      {actionMenu(false)}
    </div>
  )

  const handleTabChange = (value: DrawerTab) => {
    if (value === activeTab) return

    // Radix 在 pointer down 时切换值，早于浏览器默认聚焦，先移出退出面板。
    tabElementsRef.current.get(value)?.focus({ preventScroll: true })
    flushWorkflow(selectedJob.id).catch(() => {})
    setActiveTab(value)
  }

  const handlePrimaryAction = () => {
    if (nextAction.targetStatus) {
      handleStageJump(nextAction.targetStatus)

      return
    }

    setIsEditing(false)

    handleTabChange(
      selectedJob.status === 'interview' ? 'interview' : 'follow-up',
    )
  }

  const headerContent = (
    <div className='flex flex-col gap-2 md:gap-3'>
      <div className='flex items-start justify-between gap-3'>
        {titleBlock}
        <div className='flex shrink-0 items-center gap-1'>
          {!isMobile && desktopToolbar}
          <Button
            ref={setCloseButtonRef}
            variant='ghost'
            size='icon-sm'
            aria-label='关闭详情'
            onClick={() => handleOpenChange(false)}
          >
            <X className='size-4' />
          </Button>
        </div>
      </div>
      <DrawerMetaBar />
    </div>
  )

  const body = (
    <div
      className={cn(
        'scrollbar-thin-subtle min-h-0 flex-1 overscroll-contain',
        !isEditing
          ? 'flex flex-col overflow-hidden [@media(max-height:640px)]:block [@media(max-height:640px)]:overflow-y-auto'
          : 'scrollbar-gutter-stable overflow-y-auto',
      )}
    >
      <div
        className={cn(
          isMobile ? 'px-4 py-2' : 'px-5 py-5 lg:px-6',
          !isEditing && 'flex min-h-0 flex-1 flex-col',
        )}
      >
        {isEditing ? (
          <div className='flex flex-col gap-4'>
            <div className='flex items-center justify-between'>
              <h3 className='text-sm font-semibold'>编辑职位信息</h3>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setIsEditing(false)}
              >
                <ArrowLeft className='size-4' />
                返回
              </Button>
            </div>
            <DrawerEditForm
              key={selectedJob.id}
              onSaved={handleSaved}
              onCancel={() => setIsEditing(false)}
            />
          </div>
        ) : (
          <div className='flex min-h-0 flex-1 flex-col gap-2 md:gap-4'>
            <div className='shrink-0'>
              <ProgressTimeline
                viewingStage={viewingStage}
                onStageClick={(stage) => {
                  setViewingStage(stage === selectedJob.status ? null : stage)
                  handleTabChange('interview')
                }}
                onStageJump={handleStageJump}
              />
            </div>
            <Tabs
              className='min-h-0 flex-1'
              value={activeTab}
              onValueChange={(value) => handleTabChange(value as DrawerTab)}
            >
              <TabsList
                variant='line'
                className='relative z-20 min-h-10 w-full shrink-0 rounded-none border-b bg-popover p-0 shadow-[0_6px_10px_-10px_rgba(0,0,0,0.45)]'
              >
                {DRAWER_TABS.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    ref={(element) => {
                      if (element)
                        tabElementsRef.current.set(tab.value, element)
                      else tabElementsRef.current.delete(tab.value)
                    }}
                    value={tab.value}
                    className='h-10 flex-1 rounded-none border-0 transition-colors after:hidden'
                    style={{
                      transitionDuration: `${reduce ? 0 : DURATION.base}s`,
                      transitionTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
                    }}
                  >
                    {tab.label}
                    {activeTab === tab.value && (
                      <motion.span
                        aria-hidden
                        layoutId={reduce ? undefined : underlineId}
                        className='pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-foreground'
                        transition={{
                          duration: reduce ? 0 : DURATION.base,
                          ease: EASE.out,
                        }}
                      />
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
              <div className='relative flex min-h-0 flex-1 flex-col md:mt-4'>
                <AnimatePresence initial={false} mode='popLayout'>
                  <DrawerTabPanel key={activeTab} value={activeTab}>
                    {activeTab === 'follow-up' && (
                      <div className='flex min-h-0 flex-1 flex-col gap-2 md:gap-4'>
                        {selectedJob.status !== 'rejected' && (
                          <NextActionSection
                            key={`next-action-${selectedJob.id}`}
                            job={selectedJob}
                          />
                        )}
                        <Separator className='shrink-0' />
                        <ActivityTimeline
                          key={`activity-${selectedJob.id}`}
                          job={selectedJob}
                        />
                      </div>
                    )}
                    {activeTab === 'interview' && (
                      <div className='space-y-6'>
                        <div className='flex items-center justify-between gap-3 rounded-lg bg-muted/35 px-3 py-2'>
                          <span className='text-xs text-muted-foreground'>
                            查看阶段记录
                          </span>
                          <Select
                            value={displayStage}
                            onValueChange={(value) => {
                              flushWorkflow(selectedJob.id).catch(() => {})

                              setViewingStage(
                                value === selectedJob.status
                                  ? null
                                  : (value as ApplicationStatus),
                              )
                            }}
                          >
                            <SelectTrigger
                              aria-label='查看阶段记录'
                              className='h-8 w-40 bg-background text-xs'
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(APPLICATION_STATUS_CONFIG).map(
                                ([value, config]) => (
                                  <SelectItem key={value} value={value}>
                                    {config.label}
                                    {value === selectedJob.status && '（当前）'}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <ViewTransition
                          animationKey={`${selectedJob.id}-${displayStage}`}
                        >
                          <DrawerStageDetail displayStage={displayStage} />
                        </ViewTransition>
                      </div>
                    )}
                    {activeTab === 'documents' && (
                      <div className='space-y-6'>
                        <Contacts job={selectedJob} />
                        <DrawerDocument
                          key={selectedJob.id}
                          open={resumeOpen}
                          onOpenChange={setResumeOpen}
                        />
                      </div>
                    )}
                  </DrawerTabPanel>
                </AnimatePresence>
              </div>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  )

  const confirmDialog = (
    <AlertDialog
      open={confirmKind !== null}
      onOpenChange={(open) => !open && setConfirmKind(null)}
    >
      <AlertDialogContent
        onOpenAutoFocus={() => {
          confirmTriggerRef.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()

          const trigger = confirmTriggerRef.current
          const target = trigger?.isConnected ? trigger : closeButtonRef.current

          target?.focus({ preventScroll: true })
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {confirmKind === 'delete'
              ? '确认删除该记录？'
              : confirmKind === 'jump-offer'
                ? '确认移动到「已录用」？'
                : '确认结束该流程？'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {confirmKind === 'delete'
              ? `「${selectedJob.company} - ${selectedJob.position}」将被永久删除，无法恢复。`
              : confirmKind === 'jump-offer'
                ? '将把该职位标记为已录用。'
                : '该职位将标记为「已结束」，已有阶段与面试记录会保留。'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              confirmKind !== 'jump-offer' &&
                'bg-destructive text-destructive-foreground hover:bg-destructive/90',
            )}
            onClick={() => {
              if (confirmKind === 'delete') handleDelete()
              else if (confirmKind === 'reject') handleReject()
              else if (confirmKind === 'jump-offer')
                handleProgressChange('offer')
            }}
          >
            {confirmKind === 'delete'
              ? '删除'
              : confirmKind === 'jump-offer'
                ? '确认'
                : '结束流程'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  const mobileFooter = isMobile && !isEditing && (
    <div className='flex shrink-0 items-center gap-2 border-t bg-popover px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]'>
      {actionMenu(true)}
      <Button className='min-w-0 flex-1' onClick={handlePrimaryAction}>
        <span className='truncate'>{nextAction.label}</span>
        <ArrowRight className='size-4' />
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
          initialFocus={closeButtonRef}
          finalFocus={() =>
            drawerTriggerRef.current?.isConnected
              ? drawerTriggerRef.current
              : document.getElementById(TRACKER_SEARCH_INPUT_ID)
          }
          className='flex min-h-0 flex-col gap-0 overflow-clip p-0'
          style={
            isMobile
              ? ({
                  '--drawer-content-height': 'calc(100dvh - 1rem)',
                  '--drawer-content-max-height': 'calc(100dvh - 1rem)',
                } as CSSProperties)
              : ({
                  '--drawer-content-height': 'calc(100dvh - 1rem)',
                  '--drawer-content-max-height': 'none',
                  '--drawer-content-width':
                    'min(calc(100vw - 2rem), clamp(48rem, 62vw, 56rem))',
                } as CSSProperties)
          }
        >
          <DrawerHeader
            className={cn(
              'shrink-0 text-left',
              isMobile ? 'px-4 py-2' : 'px-5 py-4 lg:px-6',
            )}
          >
            {headerContent}
            <DrawerDescription className='sr-only'>
              {selectedJob.company}
            </DrawerDescription>
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

export default memo(JobDrawer)
