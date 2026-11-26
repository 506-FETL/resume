import { restoreDialogFocus } from '@/lib/dialog-focus'
import { useAddJob } from './use-add-job'
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
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { cn } from '@/lib/utils'
import { APPLICATION_STATUS_CONFIG } from '../../../const'
import useTrackerStore from '../../../store'
import { openTrackerTarget } from '../../../store/open-target'
import { AddJobForm } from './add-job-form'
import { AddJobStageSection } from './add-job-stage-section'

export default function AddJobDrawer({
  opener,
}: {
  opener?: HTMLElement | null
}) {
  const {
    addDrawerOpen,
    closeAddDrawer,
    isMobile,
    formData,
    submitting,
    pendingTerminal,
    setPendingTerminal,
    duplicateId,
    setDuplicateId,
    extracting,
    extractError,
    createButtonRef,
    handleChange,
    extract,
    handleResumeChange,
    handleCompanyChange,
    submitJob,
    handleSubmit,
    handleCancel,
    handleOpenChange,
  } = useAddJob()

  const fields = (
    <AddJobForm
      formData={formData}
      onChange={handleChange}
      onCompanyChange={handleCompanyChange}
    >
      <div className='space-y-2'>
        <Button
          type='button'
          variant='outline'
          disabled={extracting || !formData.jd_text.trim()}
          onClick={extract}
        >
          {extracting ? '正在提取…' : '提取岗位'}
        </Button>
        {extractError && (
          <p role='alert' className='text-sm text-destructive'>
            {extractError}
          </p>
        )}
      </div>
      <AddJobStageSection
        formData={formData}
        onChange={handleChange}
        onResumeChange={handleResumeChange}
      />
    </AddJobForm>
  )

  const actions = (
    <>
      <Button
        variant='outline'
        className={cn(isMobile && 'h-11 w-full')}
        onClick={handleCancel}
        disabled={submitting}
      >
        取消
      </Button>
      <Button
        ref={createButtonRef}
        className={cn(isMobile && 'h-11 w-full')}
        onClick={() => handleSubmit()}
        disabled={submitting}
      >
        {submitting ? '提交中...' : '创建职位'}
      </Button>
    </>
  )

  return (
    <>
      {isMobile ? (
        <Drawer
          open={addDrawerOpen}
          onOpenChange={handleOpenChange}
          showSwipeHandle
        >
          <DrawerContent
            finalFocus={
              opener
                ? () => (opener.isConnected ? opener : undefined)
                : undefined
            }
            className='max-h-[calc(100dvh-1rem)] overflow-clip'
          >
            <DrawerHeader>
              <DrawerTitle>新增职位</DrawerTitle>
              <DrawerDescription className='sr-only'>
                填写职位和公司信息。
              </DrawerDescription>
            </DrawerHeader>
            <div className='min-h-0 flex-1 overflow-y-auto px-4 py-5'>
              {fields}
            </div>
            <DrawerFooter className='grid grid-cols-2 gap-3 border-t bg-background pt-3 pb-[max(env(safe-area-inset-bottom),1rem)]'>
              {actions}
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={addDrawerOpen} onOpenChange={handleOpenChange}>
          <DialogContent
            onCloseAutoFocus={(event) => restoreDialogFocus(event, opener)}
            className='max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-lg'
          >
            <DialogHeader>
              <DialogTitle>新增职位</DialogTitle>
              <DialogDescription className='sr-only'>
                填写职位和公司信息。
              </DialogDescription>
            </DialogHeader>
            <div className='-mx-1 min-h-0 overflow-y-auto px-1'>{fields}</div>
            <DialogFooter>{actions}</DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <AlertDialog open={pendingTerminal} onOpenChange={setPendingTerminal}>
        <AlertDialogContent
          size='sm'
          onCloseAutoFocus={(event) => {
            event.preventDefault()

            if (
              useTrackerStore.getState().addDrawerOpen &&
              !createButtonRef.current?.disabled
            )
              createButtonRef.current?.focus({ preventScroll: true })
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>确认新增终态职位？</AlertDialogTitle>
            <AlertDialogDescription>
              将以「
              {APPLICATION_STATUS_CONFIG[formData.status].label}
              」创建该职位。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setPendingTerminal(false)
                submitJob()
              }}
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={duplicateId !== null}
        onOpenChange={(open) => {
          if (!open) setDuplicateId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>已有同名岗位</AlertDialogTitle>
            <AlertDialogDescription>
              同一公司和职位已存在。可以继续跟进已有岗位，或明确创建新的招聘批次。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回修改</AlertDialogCancel>
            <Button
              variant='outline'
              onClick={() => {
                const id = duplicateId

                setDuplicateId(null)
                closeAddDrawer()

                if (id) openTrackerTarget(id)
              }}
            >
              打开已有岗位
            </Button>
            <AlertDialogAction
              onClick={() => {
                setDuplicateId(null)

                if (
                  formData.status === 'offer' ||
                  formData.status === 'rejected'
                )
                  setPendingTerminal(true)
                else submitJob()
              }}
            >
              继续新建批次
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
