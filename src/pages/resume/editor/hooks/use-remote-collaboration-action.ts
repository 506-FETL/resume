import type { RefObject } from 'react'
import type { ScrollTarget } from './use-scroll-sync'
import type { UIActionBroadcastPayload } from '@/lib/collaboration'
import type { ORDERType } from '@/lib/schema'
import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import useResumeConfigStore from '@/store/resume/config'
import useResumeStore from '@/store/resume/form'

interface UseRemoteCollaborationActionOptions {
  followMode: boolean
  isApplyingRemote: RefObject<boolean>
  setDrawerOpen: (open: boolean) => void
  updateActiveTabId: (id: ORDERType) => void
  suppressScrollSync: (durationMs?: number) => void
  animateRemoteScrollTo: (target: ScrollTarget, position: number) => void
}

export function useRemoteCollaborationAction({
  followMode,
  isApplyingRemote,
  setDrawerOpen,
  updateActiveTabId,
  suppressScrollSync,
  animateRemoteScrollTo,
}: UseRemoteCollaborationActionOptions) {
  const replaceConfig = useResumeConfigStore(state => state.replaceConfig)
  const releaseApplyingFrameRef = useRef<number | null>(null)

  const handleRemoteAction = useCallback((payload: UIActionBroadcastPayload) => {
    if (!followMode) {
      return
    }

    isApplyingRemote.current = true

    switch (payload.action.kind) {
      case 'drawer-toggle':
        setDrawerOpen(payload.action.open)
        toast.info(`${payload.userName} ${payload.action.open ? '打开' : '关闭'}了编辑抽屉`, {
          duration: 2000,
          position: 'bottom-left',
        })
        break

      case 'tab-switch':
        updateActiveTabId(payload.action.tabId)
        break

      case 'section-toggle':
        useResumeStore.getState().setSectionOpen(payload.action.tabId, payload.action.open)
        break

      case 'config-spacing':
        replaceConfig({ spacing: payload.action.data })
        break

      case 'config-font':
        replaceConfig({ font: payload.action.data })
        break

      case 'config-theme':
        replaceConfig({ theme: payload.action.data })
        toast.info(`${payload.userName} 更改了主题`, {
          duration: 1500,
          position: 'bottom-left',
        })
        break

      case 'scroll':
        suppressScrollSync()
        animateRemoteScrollTo(payload.action.target, payload.action.position)
        break
    }

    if (releaseApplyingFrameRef.current !== null) {
      cancelAnimationFrame(releaseApplyingFrameRef.current)
    }
    releaseApplyingFrameRef.current = requestAnimationFrame(() => {
      releaseApplyingFrameRef.current = null
      isApplyingRemote.current = false
    })
  }, [
    animateRemoteScrollTo,
    followMode,
    isApplyingRemote,
    replaceConfig,
    setDrawerOpen,
    suppressScrollSync,
    updateActiveTabId,
  ])

  useEffect(() => {
    return () => {
      if (releaseApplyingFrameRef.current !== null) {
        cancelAnimationFrame(releaseApplyingFrameRef.current)
      }
      isApplyingRemote.current = false
    }
  }, [isApplyingRemote])

  return handleRemoteAction
}
