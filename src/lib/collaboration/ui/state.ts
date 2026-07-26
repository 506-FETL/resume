import type {
  RemoteUserUIState,
  UIStateBroadcastPayload,
} from './types'

export function createRemoteUserUIState(payload: UIStateBroadcastPayload): RemoteUserUIState {
  return {
    userId: payload.userId,
    userName: payload.userName,
    color: payload.color,
    drawerOpen: payload.state.drawerOpen,
    activeTabId: payload.state.activeTabId,
  }
}

export function mergeRemoteUIState(
  remoteUIStates: Record<number, RemoteUserUIState>,
  payload: UIStateBroadcastPayload,
) {
  return {
    ...remoteUIStates,
    [payload.userId]: createRemoteUserUIState(payload),
  }
}

export function removeRemoteUIUser(
  remoteUIStates: Record<number, RemoteUserUIState>,
  userId: number,
) {
  if (!(userId in remoteUIStates)) {
    return remoteUIStates
  }

  const next = { ...remoteUIStates }
  delete next[userId]
  return next
}
