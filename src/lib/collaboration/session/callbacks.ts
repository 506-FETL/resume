import type { SessionCallbacksOptions } from './types'
import type { CollaborationCallbacks } from '@/lib/automerge'
import { toast } from 'sonner'
import { addParticipant, createParticipant, removeParticipant } from './state'

export function createSessionCallbacks(options: SessionCallbacksOptions): CollaborationCallbacks {
  const { role, identity, getState, setState, adapterPeerIdRef } = options

  return {
    presenceMetadata: { ...identity, role },

    onPeerJoin: ({ peerId, metadata }) => {
      if (peerId === adapterPeerIdRef.current) {
        return
      }

      setState(state => ({
        participants: addParticipant(
          state.participants,
          createParticipant(peerId, metadata),
        ),
      }))

      const participantMetadata = getState().participants[peerId]?.metadata
      const displayName = participantMetadata?.userName ?? `协作者 ${peerId.slice(-4)}`
      toast.success(`${displayName} 加入协作`, { description: '已同步最新内容' })
    },

    onPeerLeave: ({ peerId }) => {
      const participantMetadata = getState().participants[peerId]?.metadata
      const displayName = participantMetadata?.userName ?? `协作者 ${peerId.slice(-4)}`

      setState(state => ({
        participants: removeParticipant(state.participants, peerId),
      }))

      if (peerId !== adapterPeerIdRef.current) {
        toast.info(`${displayName} 退出协作`)
      }
    },

    onControlMessage: ({ type }) => {
      if (type === 'share-ended' && getState().role !== 'host') {
        getState().handleRemoteShareEnd()
      }
    },
  }
}
