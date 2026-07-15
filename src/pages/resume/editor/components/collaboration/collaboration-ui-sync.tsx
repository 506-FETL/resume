/**
 * 协作 UI 同步组件
 *
 * 负责在协作模式下同步编辑器的 UI 状态：
 * 1. 监听本地 UI 变化并广播给协作者
 * 2. 接收远程 UI 动作并应用到本地
 * 3. 提供跟随模式开关
 * 4. 同步工具栏配置（间距/字体/主题）
 */
import type { RefObject } from 'react'
import type { UIAction } from '@/lib/collaboration'
import type { ORDERType } from '@/lib/schema'
import { Eye, EyeOff, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useRealtimeCollabUI } from '@/hooks/use-realtime-collab-ui'
import { useCollaborationUIStore } from '@/lib/collaboration'
import useResumeConfigStore from '@/store/resume/config'
import { useConfigBroadcast } from './hooks/use-config-broadcast'
import { useScrollSync } from './hooks/use-scroll-sync'
import { useTabDrawerBroadcast } from './hooks/use-tab-drawer-broadcast'

interface CollaborationUISyncProps {
  /** Supabase channel room name */
  roomName: string
  /** 当前用户显示名 */
  username: string
  /** 抽屉是否打开 */
  drawerOpen: boolean
  /** 设置抽屉打开状态 */
  setDrawerOpen: (open: boolean) => void
  /** 当前激活的 tab */
  activeTabId: ORDERType
  /** 切换 tab 回调 */
  onUpdateActiveTabId: (id: ORDERType) => void
  /** 预览区滚动容器 */
  scrollContainerRef: RefObject<HTMLDivElement | null>
}

export function CollaborationUISync({
  roomName,
  username,
  drawerOpen,
  setDrawerOpen,
  activeTabId,
  onUpdateActiveTabId,
  scrollContainerRef,
}: CollaborationUISyncProps) {
  const spacing = useResumeConfigStore(s => s.spacing)
  const font = useResumeConfigStore(s => s.font)
  const theme = useResumeConfigStore(s => s.theme)
  const replaceConfig = useResumeConfigStore(s => s.replaceConfig)

  const config = useMemo(() => ({ spacing, font, theme }), [spacing, font, theme])

  const isApplyingRemote = useRef(false)
  const broadcastUIActionRef = useRef<(action: UIAction) => void>(() => {})
  const stableBroadcast = useCallback((action: UIAction) => {
    broadcastUIActionRef.current(action)
  }, [])

  const { followMode, setFollowMode, latestRemoteAction, clearLatestRemoteAction, remoteUIStates } = useCollaborationUIStore()

  const {
    suppressScrollSync,
    animateRemoteScrollTo,
    getScrollPosition,
  } = useScrollSync({
    scrollContainerRef,
    isApplyingRemote,
    followMode,
    broadcastUIAction: stableBroadcast,
  })

  const { broadcastUIAction } = useRealtimeCollabUI({
    roomName,
    username,
    drawerOpen,
    activeTabId,
    config,
    getScrollPosition,
  })

  broadcastUIActionRef.current = broadcastUIAction

  useTabDrawerBroadcast({
    drawerOpen,
    activeTabId,
    isApplyingRemote,
    broadcastUIAction,
  })

  useConfigBroadcast({
    spacing,
    font,
    theme,
    isApplyingRemote,
    broadcastUIAction,
  })

  const applyRemoteAction = useCallback((action: UIAction, userName: string) => {
    isApplyingRemote.current = true

    switch (action.kind) {
      case 'drawer-toggle':
        setDrawerOpen(action.open)
        toast.info(`${userName} ${action.open ? '打开' : '关闭'}了编辑抽屉`, {
          duration: 2000,
          position: 'bottom-left',
        })
        break

      case 'tab-switch':
        onUpdateActiveTabId(action.tabId)
        break

      case 'config-spacing':
        replaceConfig({ spacing: action.data })
        break

      case 'config-font':
        replaceConfig({ font: action.data })
        break

      case 'config-theme':
        replaceConfig({ theme: action.data })
        toast.info(`${userName} 更改了主题`, { duration: 1500, position: 'bottom-left' })
        break

      case 'scroll':
        suppressScrollSync()
        animateRemoteScrollTo(action.target, action.position)
        break
    }

    requestAnimationFrame(() => {
      isApplyingRemote.current = false
    })
  }, [animateRemoteScrollTo, setDrawerOpen, onUpdateActiveTabId, replaceConfig, suppressScrollSync])

  useEffect(() => {
    if (!latestRemoteAction || !followMode)
      return

    applyRemoteAction(latestRemoteAction, latestRemoteAction.userName)
    clearLatestRemoteAction()
  }, [latestRemoteAction, followMode, applyRemoteAction, clearLatestRemoteAction])

  const activeRemoteUsers = Object.values(remoteUIStates)

  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={followMode ? 'default' : 'outline'}
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => {
              setFollowMode(!followMode)
              toast.info(followMode ? '已关闭跟随模式' : '已开启跟随模式', {
                description: followMode
                  ? '将不再同步协作者的 UI 操作'
                  : '将自动跟随协作者的 UI 操作',
                duration: 2000,
              })
            }}
          >
            {followMode ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
            {followMode ? '跟随中' : '独立浏览'}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {followMode
            ? '跟随模式：协作者的 UI 操作将自动同步到你的界面'
            : '独立浏览模式：不同步协作者的 UI 操作'}
        </TooltipContent>
      </Tooltip>

      {activeRemoteUsers.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="gap-1 h-7 text-xs cursor-default">
              <Users className="size-3" />
              {activeRemoteUsers.length}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <p className="font-medium mb-1">在线协作者</p>
              {activeRemoteUsers.map(u => (
                <div key={u.userId} className="flex items-center gap-2 py-0.5">
                  <div
                    className="size-2 rounded-full"
                    style={{ backgroundColor: u.color }}
                  />
                  <span>{u.userName}</span>
                  <span className="text-muted-foreground">
                    {u.drawerOpen ? '编辑中' : '预览中'}
                    {u.activeTabId ? ` · ${u.activeTabId}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
