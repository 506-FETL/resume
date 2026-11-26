import { DrawerEditForm, DrawerStageDetail } from './deferred-sections'
import { useSearchParams } from 'react-router-dom'
import type { ComponentProps } from 'react'
import type { ApplicationStatus, DrawerTab } from '../../types'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import {
  useEffect,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import type { Drawer } from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/use-mobile'
import { APPLICATION_STATUS_ORDER } from '../../const'
import {
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
  isTrackerAccountScopeError,
} from '../../lib/account-scope'
import useTrackerStore, { getTrackerConflictAction } from '../../store'
import { selectTrackerDrawerJob } from '../../store/selectors'
import { getTrackerErrorMessage } from '../../utils'

type ConfirmKind = 'reject' | 'delete' | 'jump-offer'

export function useJobDrawer() {
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
  const [routeParams] = useSearchParams()
  const routeTab = routeParams.get('tab')
  const routeJobId = routeParams.get('jobId')
  const [activeTab, setActiveTab] = useState<DrawerTab>('follow-up')
  const [isEditing, setIsEditing] = useState(false)

  const [viewingStage, setViewingStage] = useState<ApplicationStatus | null>(
    null,
  )

  const [confirmKind, setConfirmKind] = useState<ConfirmKind>('reject')
  const [confirmOpen, setConfirmOpen] = useState(false)
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

    setActiveTab(
      selectedJob?.id === routeJobId &&
        (routeTab === 'documents' || routeTab === 'interview')
        ? routeTab
        : 'follow-up',
    )

    setIsEditing(false)
    setViewingStage(null)
    setConfirmOpen(false)
  }, [selectedJob?.id, drawerOpen, routeJobId, routeTab])

  useEffect(() => {
    if (!drawerOpen) return

    if (isEditing) DrawerEditForm.preload().catch(() => {})
    else if (
      activeTab === 'interview' &&
      (viewingStage ?? selectedJob?.status) !== 'applied'
    )
      DrawerStageDetail.preload().catch(() => {})
  }, [activeTab, drawerOpen, isEditing, selectedJob?.status, viewingStage])

  const handleOpenChange = (
    newOpen: boolean,
    details?: Parameters<
      NonNullable<ComponentProps<typeof Drawer>['onOpenChange']>
    >[1],
  ) => {
    // Radix Select 可能把后续点击重定向到 body；上层弹窗退出前不能因此关闭抽屉。
    if (
      !newOpen &&
      (details?.reason === 'escape-key' ||
        details?.reason === 'outside-press') &&
      document.querySelector(
        '[data-slot="dialog-content"], [role="alertdialog"]',
      )
    ) {
      details.cancel()

      return
    }

    // Radix 可能先卸载日历节点，用原始事件路径识别浮层，Esc 只关闭当前层。
    if (
      !newOpen &&
      details?.reason === 'escape-key' &&
      details.event
        .composedPath()
        .some(
          (node) =>
            node instanceof Element &&
            node.matches(
              '[data-slot="dialog-content"], [role="alertdialog"], [role="listbox"], [role="menu"], [data-slot="popover-content"]',
            ),
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

    const scope = getTrackerAccountScope()
    const { id, status } = selectedJob

    changeJobStatus(id, newStatus)
      .then(() => {
        const current = selectTrackerDrawerJob(useTrackerStore.getState())

        if (
          isTrackerAccountScopeCurrent(scope) &&
          current?.id === id &&
          current.status !== status
        )
          setViewingStage(null)
      })
      .catch((error) => {
        if (!isTrackerAccountScopeError(error))
          toast.error('更新失败', {
            description: getTrackerErrorMessage(error),
            action: getTrackerConflictAction(error),
          })
      })
  }

  const openConfirmation = (kind: ConfirmKind) => {
    setConfirmKind(kind)
    setConfirmOpen(true)
  }

  // 预览与推进分开；状态动作继续经过原有终态、投递与恢复流程。
  const handleStageJump = (target: ApplicationStatus) => {
    if (!selectedJob || target === selectedJob.status) return
    if (target === 'offer') {
      openConfirmation('jump-offer')

      return
    }
    if (target === 'rejected') {
      openConfirmation('reject')

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
    setConfirmOpen(false)
  }

  const handleDelete = async () => {
    if (!selectedJob) return

    setConfirmOpen(false)

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

  return {
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
  }
}
