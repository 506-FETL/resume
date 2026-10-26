import type { SessionCallbacksOptions } from './types'
import type { CollaborationCallbacks } from '@/lib/automerge'
import { toast } from 'sonner'
import {
  addParticipant,
  createParticipant,
  hasParticipantUser,
  removeParticipant,
} from './state'

export function createSessionCallbacks(
  options: SessionCallbacksOptions,
): CollaborationCallbacks {
  const {
    role,
    identity,
    getState,
    setState,
    adapterPeerIdRef,
    isCurrentSession,
  } = options

  return {
    presenceMetadata: { ...identity, role },
    onDisconnect: () => {
      if (isCurrentSession()) {
        if (role === 'guest') {
          getState().handleRemoteShareEnd()
        } else {
          setState({
            isSharing: false,
            isConnecting: false,
            phase: 'error',
            error: '协作连接已断开，请重新开启协作',
          })
        }
      }
    },

    onPeerJoin: ({ peerId, metadata }) => {
      if (!isCurrentSession() || peerId === adapterPeerIdRef.current) {
        return
      }

      const participant = createParticipant(peerId, metadata)
      const { userId, userName } = participant.metadata
      const wasPresent = hasParticipantUser(getState().participants, userId)

      setState((state) => ({
        participants: isCurrentSession()
          ? addParticipant(state.participants, participant)
          : state.participants,
      }))

      if (!isCurrentSession() || wasPresent || userId === identity.userId)
        return

      toast.success(`${userName} 加入协作`, {
        description: '已同步最新内容',
      })
    },

    onPeerLeave: ({ peerId }) => {
      if (!isCurrentSession() || peerId === adapterPeerIdRef.current) return

      const participant = getState().participants[peerId]

      if (!participant) return

      const { userId, userName } = participant.metadata

      setState((state) => ({
        participants: isCurrentSession()
          ? removeParticipant(state.participants, peerId)
          : state.participants,
      }))

      // 一个用户可能有多个标签页，旧连接离开不代表这个人已经离开。
      if (
        isCurrentSession() &&
        userId !== identity.userId &&
        !hasParticipantUser(getState().participants, userId)
      ) {
        toast.info(`${userName} 退出协作`)
      }
    },

    onControlMessage: ({ type }) => {
      if (
        isCurrentSession() &&
        type === 'share-ended' &&
        getState().role !== 'host'
      ) {
        getState().handleRemoteShareEnd()
      }
    },
  }
}
