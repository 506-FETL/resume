import type { useQueueDrain } from './use-queue-drain'
import { interruption } from './interruption'
import type { AiUserReference } from '@/lib/ai/types'
import { useCallback } from 'react'
import { toast } from 'sonner'
import { createSkillReferences } from '@/lib/ai/skills/references'
import { uniqueReferences } from '@/lib/ai/references'
import type { AssistantSubmission } from '../../store/composer-slice'
import { resolveActiveResumeId } from '@/lib/ai/active-resume'
import { freezeSourceScope, peekSourceScope } from '../../store/source-scope'
import { assistantRunner as runner } from '../../runtime/assistant-run'
import useUserStore from '@/store/user'
import { getErrorMessage } from '@/utils'
import useAssistantStore from '../../store'

export function useSendActions(drainQueue: ReturnType<typeof useQueueDrain>) {
  const sendMessage = useCallback(
    (
      text: string,
      selected: AiUserReference[] = [],
      mode: 'queue' | 'interrupt' | 'feedback' = 'feedback',
    ): boolean => {
      const state = useAssistantStore.getState()
      const ownerId = useUserStore.getState().currentUser?.id

      if (
        !ownerId ||
        state.loadingMessages ||
        state.initializing ||
        state.bootstrapError
      )
        return false
      if (state.composerUploadCount) {
        toast.info('请先等文件上传完成，或重试、移除未完成的文件。')

        return false
      }

      try {
        const references = uniqueReferences([
          ...selected,
          ...createSkillReferences(text),
        ])

        const trimmed = text.trim()

        if (!trimmed && !references.length) return false

        const targetResumeId = resolveActiveResumeId()
        const explicitSources = freezeSourceScope([], references)

        const scope = explicitSources.length
          ? explicitSources
          : (state.composerLibrarySources ??
            peekSourceScope({
              ownerId,
              conversationId: state.activeConversationId,
              resumeId: targetResumeId,
              scopeRevision: state.sourceScopeRevision,
            }))

        if (!scope) {
          toast.error('资料范围尚未读取完成，请稍后再发送。')

          return false
        }

        const pending = state.pendingConfirm
        const revising = pending?.status === 'pending' && mode === 'feedback'

        const submission: AssistantSubmission = {
          id: crypto.randomUUID(),
          ownerId,
          conversationId: state.activeConversationId,
          text: trimmed,
          references,
          thinking: state.deepThinking,
          targetResumeId,
          sources: freezeSourceScope(scope, references),
          createdAt: new Date().toISOString(),
          ...(revising ? { proposalId: pending.id } : {}),
        }

        if (revising && !trimmed) return false
        if (revising)
          pending.resolve({
            kind: 'revise',
            feedback: trimmed,
            proposalId: pending.id,
          })

        const interrupt = mode === 'interrupt' || Boolean(revising)

        if (
          runner.busy &&
          state.runPhase === 'settling' &&
          !state.abortController
        )
          interruption.continueAfterInterruption = true

        useAssistantStore.setState((current) => ({
          queuedMessages: interrupt
            ? [submission, ...current.queuedMessages]
            : [...current.queuedMessages, submission],
          queuePaused: false,
        }))

        if (interrupt && runner.busy) {
          interruption.continueAfterInterruption = true
          state.abortController?.abort()
          useAssistantStore.setState({ runPhase: 'settling' })
        }

        drainQueue()

        return true
      } catch (error) {
        toast.error('无法发送消息', { description: getErrorMessage(error) })

        return false
      }
    },
    [drainQueue],
  )

  const reviseConfirmation = useCallback(() => {
    const state = useAssistantStore.getState()

    const sent = sendMessage(
      state.confirmationFeedback,
      state.composerReferences,
      'feedback',
    )

    if (sent)
      useAssistantStore.setState({
        confirmationFeedback: '',
        composerReferences: [],
        composerSkillIds: [],
        composerLibrarySources: null,
      })

    return sent
  }, [sendMessage])

  return { sendMessage, reviseConfirmation }
}
