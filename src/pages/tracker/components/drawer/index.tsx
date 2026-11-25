import { useJobDrawer } from './use-job-drawer'
import { DrawerActionMenu } from './action-menu'
import { DrawerHeaderContent } from './header-content'
import { DrawerConfirmation } from './confirmation'
import { FocusButton } from '../focus-button'
import type { CSSProperties } from 'react'
import type { DrawerTab } from '../../types'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { memo } from 'react'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
} from '@/components/ui/drawer'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import {
  APPLICATION_STATUS_CONFIG,
  APPLICATION_STATUS_ORDER,
  TRACKER_SEARCH_INPUT_ID,
} from '../../const'
import { getTrackerNextAction } from '../../utils'
import ViewTransition from '../view-transition'
import ActivityTimeline from './activity-timeline'
import Contacts from './contacts'
import JobDetailContent from './job-detail-content'
import DrawerDocument from './document/index'
import SubmissionList from './submission-list'
import DrawerEditForm from './edit-form'
import NextActionSection from './next-action'
import ProgressTimeline from './progress-timeline/index'
import DrawerStageDetail from './stage-detail/index'
import DrawerTabPanel from './tab-panel'

const DRAWER_TABS: { value: DrawerTab; label: string }[] = [
  { value: 'follow-up', label: '跟进' },
  { value: 'interview', label: '阶段详情' },
  { value: 'documents', label: '联系人与简历' },
]

function JobDrawer() {
  const {
    selectedJob,
    drawerOpen,
    flushWorkflow,
    isMobile,
    reduce,
    underlineId,
    activeTab,
    setActiveTab,
    isEditing,
    setIsEditing,
    viewingStage,
    setViewingStage,
    confirmKind,
    confirmOpen,
    setConfirmOpen,
    confirmTriggerRef,
    closeButtonRef,
    drawerTriggerRef,
    tabElementsRef,
    setCloseButtonRef,
    handleOpenChange,
    handleSaved,
    handleProgressChange,
    openConfirmation,
    handleStageJump,
    handleStepBack,
    handleReject,
    handleDelete,
    handleArchive,
  } = useJobDrawer()

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

  const displayStage = viewingStage || selectedJob.status
  const displayStageLabel = APPLICATION_STATUS_CONFIG[displayStage].label
  const isCurrentStage = displayStage === selectedJob.status

  const isPreviousStage =
    APPLICATION_STATUS_ORDER.indexOf(displayStage) <
    APPLICATION_STATUS_ORDER.indexOf(selectedJob.status)

  const stageActionLabel = isCurrentStage
    ? '当前阶段'
    : displayStage === 'rejected'
      ? '结束该流程'
      : displayStage === 'offer'
        ? '标记为已录用'
        : selectedJob.status === 'rejected' && displayStage !== 'saved'
          ? '恢复流程'
          : `${isPreviousStage ? '回到' : '推进到'}「${displayStageLabel}」`

  const nextAction = getTrackerNextAction(selectedJob)

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

  const actionMenu = (includeEdit: boolean) => (
    <DrawerActionMenu
      selectedJob={selectedJob}
      includeEdit={includeEdit}
      setIsEditing={setIsEditing}
      handleStepBack={handleStepBack}
      openConfirmation={openConfirmation}
      handleArchive={handleArchive}
    />
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
          isMobile ? 'px-4 py-2' : 'px-5 py-3 lg:px-6',
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
            <JobDetailContent key={selectedJob.id} field='jd_text'>
              {() => (
                <DrawerEditForm
                  onSaved={handleSaved}
                  onCancel={() => setIsEditing(false)}
                />
              )}
            </JobDetailContent>
          </div>
        ) : (
          <div className='flex min-h-0 flex-1 flex-col gap-2 md:gap-3'>
            <div className='shrink-0'>
              <ProgressTimeline
                viewingStage={viewingStage}
                onStageClick={(stage) => {
                  flushWorkflow(selectedJob.id).catch(() => {})
                  setViewingStage(stage === selectedJob.status ? null : stage)
                  handleTabChange('interview')
                }}
              />
            </div>
            <Tabs
              className='min-h-0 flex-1'
              value={activeTab}
              onValueChange={(value) => handleTabChange(value as DrawerTab)}
            >
              <TabsList
                variant='line'
                className='relative z-20 min-h-10 w-full shrink-0 rounded-none border-b bg-popover p-0 shadow-none'
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
              <div className='relative flex min-h-0 flex-1 flex-col md:mt-3'>
                <AnimatePresence initial={false} mode='popLayout'>
                  <DrawerTabPanel key={activeTab} value={activeTab}>
                    {activeTab === 'follow-up' && (
                      <div className='flex min-h-0 flex-1 flex-col gap-2 md:gap-3'>
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
                        <div className='flex flex-wrap items-center justify-between gap-2 border-b pb-3'>
                          <span className='text-xs text-muted-foreground'>
                            查看阶段记录
                          </span>
                          <Button
                            size='sm'
                            variant={isCurrentStage ? 'secondary' : 'outline'}
                            disabled={isCurrentStage}
                            onClick={() => handleStageJump(displayStage)}
                            className='h-8 max-w-full text-xs'
                          >
                            {stageActionLabel}
                            {!isCurrentStage && (
                              <ArrowRight className='size-3.5' />
                            )}
                          </Button>
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
                        <JobDetailContent key={selectedJob.id} field='contacts'>
                          {(contacts) => (
                            <Contacts
                              jobId={selectedJob.id}
                              storedContacts={contacts}
                            />
                          )}
                        </JobDetailContent>
                        <DrawerDocument key={`document-${selectedJob.id}`} />
                        <SubmissionList
                          key={`submissions-${selectedJob.id}`}
                          jobId={selectedJob.id}
                          onViewDetails={() => {
                            handleTabChange('interview')
                            setViewingStage('applied')
                          }}
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

  const mobileFooter = isMobile && !isEditing && (
    <div className='flex shrink-0 items-center gap-2 border-t bg-popover px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]'>
      <FocusButton job={selectedJob} />
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
            <DrawerHeaderContent
              selectedJob={selectedJob}
              actionMenu={actionMenu(false)}
              isMobile={isMobile}
              isEditing={isEditing}
              setIsEditing={setIsEditing}
              handleStageJump={handleStageJump}
              setCloseButtonRef={setCloseButtonRef}
              handleOpenChange={handleOpenChange}
            />
            <DrawerDescription className='sr-only'>
              {selectedJob.company}
            </DrawerDescription>
          </DrawerHeader>
          <Separator />
          {body}
          {mobileFooter}
        </DrawerContent>
      </Drawer>
      <DrawerConfirmation
        selectedJob={selectedJob}
        reduce={reduce}
        confirmKind={confirmKind}
        confirmOpen={confirmOpen}
        setConfirmOpen={setConfirmOpen}
        confirmTriggerRef={confirmTriggerRef}
        closeButtonRef={closeButtonRef}
        handleProgressChange={handleProgressChange}
        handleReject={handleReject}
        handleDelete={handleDelete}
      />
    </>
  )
}

export default memo(JobDrawer)
