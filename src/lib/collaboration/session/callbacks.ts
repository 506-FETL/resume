import type { SessionCallbacksOptions } from './types'
import type { CollaborationCallbacks } from '@/lib/automerge'
import { toast } from 'sonner'
import { addParticipant, createParticipant, removeParticipant } from './state'

export function createSessionCallbacks(options: SessionCallbacksOptions): CollaborationCallbacks {
  const { role, identity, getState, setState, adapterPeerIdRef, isCurrentSession } = options

  return {
    presenceMetadata: { ...identity, role },

    onPeerJoin: ({ peerId, metadata }) => {
      if (!isCurrentSession() || peerId === adapterPeerIdRef.current) {
        return
      }

      setState(state => ({
        participants: isCurrentSession()
          ? addParticipant(
              state.participants,
              createParticipant(peerId, metadata),
            )
          : state.participants,
      }))

      if (!isCurrentSession())
        return

      const participantMetadata = getState().participants[peerId]?.metadata
      const displayName = participantMetadata?.userName ?? `协作者 ${peerId.slice(-4)}`
      toast.success(`${displayName} 加入协作`, { description: '已同步最新内容' })
    },

    onPeerLeave: ({ peerId }) => {
      if (!isCurrentSession())
        return

      const participantMetadata = getState().participants[peerId]?.metadata
      const displayName = participantMetadata?.userName ?? `协作者 ${peerId.slice(-4)}`

      setState(state => ({
        participants: isCurrentSession()
          ? removeParticipant(state.participants, peerId)
          : state.participants,
      }))

      if (isCurrentSession() && peerId !== adapterPeerIdRef.current) {
        toast.info(`${displayName} 退出协作`)
      }
    },

    onControlMessage: ({ type }) => {
      if (
        isCurrentSession()
        && type === 'share-ended'
        && getState().role !== 'host'
      ) {
        getState().handleRemoteShareEnd()
      }
    },
  }
}
