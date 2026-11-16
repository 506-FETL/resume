import type { useQueueDrain } from './use-queue-drain'
import { loadRunSources } from './load-run-sources'
import { useCallback } from 'react'
import { toast } from 'sonner'
import { recordAssistantRunCompaction } from '../../runtime/assistant-run'
import { resolveActiveResumeId } from '@/lib/ai/active-resume'
import { freezeSourceScope, peekSourceScope } from '../../store/source-scope'
import {
  assistantRunner as runner,
  executeAssistantRun,
} from '../../runtime/assistant-run'
import {
  getDraftRecoveryEpoch,
  getAssistantAccountGeneration,
} from '../../store/composer-sessions'
import { prepareConversationContext } from '@/lib/ai/agent/conversation-context'
import { QuotaExceededError } from '@/lib/llm/call'
import { refetchAiQuota } from '@/store/ai-quota'
import { openUpgradeDialog } from '@/store/upgrade-dialog'
import useUserStore from '@/store/user'
import { getErrorMessage } from '@/utils'
import useAssistantStore from '../../store'

export function useCompaction(drainQueue: ReturnType<typeof useQueueDrain>) {
  const compactContext = useCallback(() => {
    const state = useAssistantStore.getState()
    const ownerId = useUserStore.getState().currentUser?.id
    const conversationId = state.activeConversationId
    const targetResumeId = resolveActiveResumeId()

    if (
      !ownerId ||
      !conversationId ||
      runner.busy ||
      state.loadingMessages ||
      state.initializing ||
      state.bootstrapError ||
      state.pendingAssistantWrite ||
      state.pendingMessageUpdates.length ||
      state.queuedMessages.length ||
      state.pendingConfirm
    )
      return false

    const explicitSources = freezeSourceScope([], state.composerReferences)

    const sources = explicitSources.length
      ? explicitSources
      : (state.composerLibrarySources ??
        peekSourceScope({
          ownerId,
          conversationId,
          resumeId: targetResumeId,
          scopeRevision: state.sourceScopeRevision,
        }))

    if (!sources) return false

    const viewVersion = state.conversationViewVersion
    const accountGeneration = getAssistantAccountGeneration()
    const recoveryEpoch = getDraftRecoveryEpoch(ownerId)

    runner
      .start(async () => {
        await executeAssistantRun(
          {
            ownerId,
            recoveryEpoch,
            accountGeneration,
            conversationId,
            submissionId: crypto.randomUUID(),
            targetResumeId,
          },
          async ({ controller }) => {
            const ownsView = () =>
              !controller.signal.aborted &&
              getAssistantAccountGeneration() === accountGeneration &&
              getDraftRecoveryEpoch(ownerId) === recoveryEpoch &&
              useUserStore.getState().currentUser?.id === ownerId &&
              useAssistantStore.getState().conversationViewVersion ===
                viewVersion

            if (!ownsView()) return 'interrupted'

            const unsubscribe = useAssistantStore.subscribe(() => {
              if (!ownsView()) controller.abort()
            })

            const unsubscribeUser = useUserStore.subscribe(() => {
              if (!ownsView()) controller.abort()
            })

            useAssistantStore.setState({
              runPhase: 'compacting',
              abortController: controller,
            })

            state.beginConversationRun(conversationId)

            try {
              const { sources: runSources } = await loadRunSources(
                sources,
                conversationId,
                controller.signal,
              )

              const result = await prepareConversationContext(
                conversationId,
                controller.signal,
                {
                  resumeId: targetResumeId,
                  sources: runSources,
                  forceCompaction: true,
                  onCompaction: recordAssistantRunCompaction,
                },
              )

              if (controller.signal.aborted || !ownsView()) return 'interrupted'

              if (result.summary) {
                useAssistantStore.setState({
                  contextCompaction: {
                    conversationId,
                    viewVersion,
                    messageCount: result.compactedMessageCount,
                  },
                })

                if (result.compactedMessageCount) toast.success('上下文已压缩')
                else toast.info('较早对话已压缩，无需再次整理')
              } else toast.info('还没有需要压缩的较早对话，最近 4 轮会完整保留')
            } catch (error) {
              if (controller.signal.aborted || !ownsView()) return 'interrupted'

              if (error instanceof QuotaExceededError) openUpgradeDialog()
              else
                toast.error('上下文压缩失败，原消息仍保留', {
                  description: getErrorMessage(error),
                })

              return 'paused'
            } finally {
              unsubscribe()
              unsubscribeUser()
              useAssistantStore.getState().finishConversationRun(conversationId)

              if (useAssistantStore.getState().abortController === controller)
                useAssistantStore.setState({
                  abortController: null,
                  runPhase: 'idle',
                })
              else if (
                useUserStore.getState().currentUser?.id === ownerId &&
                useAssistantStore.getState().conversationViewVersion ===
                  viewVersion
              )
                useAssistantStore.setState({ runPhase: 'idle' })

              refetchAiQuota()
            }
          },
        )
      })
      .finally(() => {
        if (!useAssistantStore.getState().queuePaused) drainQueue()
      })

    return true
  }, [drainQueue])

  return compactContext
}
