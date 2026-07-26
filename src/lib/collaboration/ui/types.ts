import type { FontConfigType, ORDERType, SpacingConfigType, ThemeConfigType } from '@/lib/schema'

export interface RemoteUserUIState {
  userId: number
  userName: string
  color: string
  drawerOpen: boolean
  activeTabId: ORDERType | null
}

export interface UIStateBroadcastPayload {
  type: 'ui-state-update'
  userId: number
  userName: string
  color: string
  state: {
    drawerOpen: boolean
    activeTabId: ORDERType | null
  }
  timestamp: number
}

export type UIAction
  = | { kind: 'drawer-toggle', open: boolean }
    | { kind: 'tab-switch', tabId: ORDERType }
    | { kind: 'scroll', position: number, target: 'window' | 'preview' }
    | { kind: 'config-spacing', data: Partial<SpacingConfigType> }
    | { kind: 'config-font', data: Partial<FontConfigType> }
    | { kind: 'config-theme', data: Partial<ThemeConfigType> }

export interface UIActionBroadcastPayload {
  type: 'ui-action'
  action: UIAction
  userId: number
  userName: string
  color: string
  timestamp: number
}

export interface CollaborationUIIdentity {
  userId: number
  userName: string
  color: string
}
