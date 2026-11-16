import type { useRunSend } from './use-run-send'
import { interruption } from './interruption'
import { useCallback } from 'react'
import { toast } from 'sonner'
import { assistantRunner as runner } from '../../runtime/assistant-run'
import {
  getDraftRecoveryEpoch,
  updateConversationDraft,
} from '../../store/composer-sessions'
import { insertMessage, updateMessage } from '@/lib/supabase/ai'
import useUserStore from '@/store/user'
import { getErrorMessage } from '@/utils'
import useAssistantStore from '../../store'

export function useQueueDrain(runSend: ReturnType<typeof useRunSend>) {
  const drainQueue = useCallback(
    function drainQueue() {
      return runner
        .start(async () => {
          while (true) {
            const state = useAssistantStore.getState()
            const next = state.queuedMessages[0]
            const viewVersion = state.conversationViewVersion
            const ownerId = useUserStore.getState().currentUser?.id

            if (state.queuePaused || state.loadingMessages || !ownerId) break

            const pendingUpdate = state.pendingMessageUpdates[0]

            if (pendingUpdate) {
              const recoveryEpoch = getDraftRecoveryEpoch(ownerId)

              useAssistantStore.setState({ runPhase: 'saving' })

              try {
                await updateMessage(pendingUpdate.id, {
                  parts: pendingUpdate.parts,
                })

                updateConversationDraft(
                  useAssistantStore,
                  ownerId,
                  pendingUpdate.conversationId,
                  (draft) => ({
                    pendingMessageUpdates: draft.pendingMessageUpdates.filter(
                      (message) => message.id !== pendingUpdate.id,
                    ),
                  }),
                  recoveryEpoch,
                )
              } catch (error) {
                toast.error('修改记录仍未保存，队列已暂停', {
                  description: getErrorMessage(error),
                })

                useAssistantStore.setState({ queuePaused: true })
                break
              }

              if (
                useUserStore.getState().currentUser?.id !== ownerId ||
                useAssistantStore.getState().conversationViewVersion !==
                  viewVersion
              )
                break

              useAssistantStore.setState({ queuePaused: false })
              continue
            }

            const pending = state.pendingAssistantWrite
            const recoveryEpoch = getDraftRecoveryEpoch(ownerId)

            if (pending) {
              if (
                pending.userId !== ownerId ||
                pending.conversationId !== state.activeConversationId
              )
                break

              useAssistantStore.setState({ runPhase: 'saving' })

              try {
                const saved = await insertMessage(pending.conversationId, {
                  id: pending.id,
                  role: 'assistant',
                  parts: pending.parts,
                })

                const current = useAssistantStore.getState()

                if (useUserStore.getState().currentUser?.id !== ownerId) break
                if (current.activeConversationId !== pending.conversationId) {
                  updateConversationDraft(
                    useAssistantStore,
                    ownerId,
                    pending.conversationId,
                    () => ({ pendingAssistantWrite: null }),
                    recoveryEpoch,
                  )

                  break
                }

                useAssistantStore.setState({ pendingAssistantWrite: null })

                if (
                  current.messages.some((message) => message.id === pending.id)
                )
                  current.replaceMessage(pending.id, saved)
                else current.appendMessage(saved)
              } catch (error) {
                updateConversationDraft(
                  useAssistantStore,
                  ownerId,
                  pending.conversationId,
                  () => ({ pendingAssistantWrite: pending }),
                  recoveryEpoch,
                )

                toast.error('回复仍未保存，稍后可继续核对', {
                  description: getErrorMessage(error),
                })

                break
              }

              continue
            }

            if (
              !next ||
              next.ownerId !== ownerId ||
              next.conversationId !== state.activeConversationId
            )
              break

            useAssistantStore.setState({
              queuedMessages: state.queuedMessages.slice(1),
            })

            const outcome = await runSend(
              next.text,
              next.references,
              undefined,
              next,
            )

            const current = useAssistantStore.getState()

            const stillOwnsView =
              ownerId === useUserStore.getState().currentUser?.id &&
              current.conversationViewVersion === viewVersion

            if (!stillOwnsView) break
            if (
              outcome === 'paused' ||
              (outcome === 'interrupted' &&
                !interruption.continueAfterInterruption)
            ) {
              useAssistantStore.setState({ queuePaused: true })
              interruption.continueAfterInterruption = false
              break
            }

            interruption.continueAfterInterruption = false
          }

          if (!useAssistantStore.getState().streaming)
            useAssistantStore.setState({ runPhase: 'idle' })
        })
        .catch((error) => {
          useAssistantStore.setState({ queuePaused: true, runPhase: 'idle' })
          toast.error('发送已暂停', { description: getErrorMessage(error) })
        })
        .finally(() => {
          const state = useAssistantStore.getState()
          const next = state.queuedMessages[0]

          if (
            !runner.busy &&
            !state.queuePaused &&
            !state.loadingMessages &&
            next?.ownerId === useUserStore.getState().currentUser?.id &&
            next.conversationId === state.activeConversationId
          )
            queueMicrotask(() => drainQueue())
        })
    },
    [runSend],
  )

  return drainQueue
}
