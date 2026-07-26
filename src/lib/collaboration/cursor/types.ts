export interface CursorPosition {
  x: number
  y: number
}

export interface CursorViewport {
  width: number
  height: number
}

export interface CursorUserInfo {
  id: number
  name: string
}

export interface CursorEventPayload {
  position: CursorPosition
  viewport?: CursorViewport
  user: CursorUserInfo
  color: string
  timestamp: number
}

export type RealtimeCursorMap = Record<string, CursorEventPayload>

export interface UseRealtimeCursorsOptions {
  roomName: string
  username: string
  color: string
  throttleMs: number
}

export interface UseRealtimeCursorsReturn {
  cursors: RealtimeCursorMap
}
