import type { SessionCallbacksOptions } from './types'
import type { CollaborationCallbacks } from '@/lib/automerge'
import { toast } from 'sonner'
import { addParticipant, createParticipant, removeParticipant } from './state'

function getParticipantDisplayName(
  peerId: string,
  ...metadataSources: Array<Record<string, any> | undefined>
) {
  for (const metadata of metadataSources) {
    for (const name of [metadata?.userName, metadata?.name]) {
      if (typeof name === 'string' && name.trim()) {
        return name.trim()
      }
    }
  }
  return `协作者 ${peerId.slice(-4)}`
}

export function createSessionCallbacks(options: SessionCallbacksOptions): CollaborationCallbacks {
  const { role, userId, userName, color, getState, setState, adapterPeerIdRef } = options

  return {
    presenceMetadata: { userId, userName, color, role },

    onChannelReady: (channelName) => {
      setState({ channelName })
    },

    onPeerJoin: ({ peerId, metadata }) => {
      if (peerId === adapterPeerIdRef.current) {
        return
      }

      const displayName = getParticipantDisplayName(peerId, metadata)
      toast.success(`${displayName} 加入协作`, { description: '已同步最新内容' })

      setState(state => ({
        participants: addParticipant(
          state.participants,
          createParticipant(peerId, metadata),
        ),
      }))
    },

    onPeerLeave: ({ peerId, metadata }) => {
      const participantMetadata = getState().participants[peerId]?.metadata
      const displayName = getParticipantDisplayName(peerId, metadata, participantMetadata)

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
