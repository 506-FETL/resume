import type { AiMessage } from '@/lib/ai/types'
import {
  getDraftRecoveryEpoch,
  getAssistantAccountGeneration,
} from '../../../store/composer-sessions'
import useUserStore from '@/store/user'
import { resolveActiveResumeId } from '@/lib/ai/active-resume'
import { persistAssistantMessageUpdate } from '../../../runtime/message-persistence'
import {
  assistantRunner,
  executeAssistantRun,
  getAssistantRun,
} from '../../../runtime/assistant-run'
import useAssistantStore from '../../../store'

export async function markChangeState(
  toolCallId: string,
  undone: boolean,
  messages: AiMessage[],
): Promise<boolean> {
  const index = messages.findIndex((message) =>
    message.parts.some(
      (part) => part.type === 'tool-call' && part.toolCallId === toolCallId,
    ),
  )

  const owner = messages[index]

  if (!owner) return false

  const updated = {
    ...owner,
    parts: owner.parts.map((part) =>
      part.type === 'tool-call' && part.toolCallId === toolCallId
        ? { ...part, undone }
        : part,
    ),
  }

  const current = useAssistantStore.getState()

  messages[index] = updated

  if (
    useUserStore.getState().currentUser?.id === owner.userId &&
    current.activeConversationId === owner.conversationId &&
    !getAssistantRun()?.controller.signal.aborted
  )
    current.replaceMessage(owner.id, updated)

  return persistAssistantMessageUpdate(
    updated,
    getAssistantRun()?.recoveryEpoch,
  )
}

export async function runCanvasWrite(
  work: () => Promise<void>,
  targetResumeId = useAssistantStore.getState().previewResumeId ??
    resolveActiveResumeId(),
): Promise<void> {
  const state = useAssistantStore.getState()
  const ownerId = useUserStore.getState().currentUser?.id

  if (
    assistantRunner.busy ||
    !ownerId ||
    state.pendingAssistantWrite ||
    state.pendingMessageUpdates.length
  )
    return

  await assistantRunner.start(() =>
    executeAssistantRun(
      {
        ownerId,
        recoveryEpoch: getDraftRecoveryEpoch(ownerId),
        accountGeneration: getAssistantAccountGeneration(),
        conversationId: state.activeConversationId,
        submissionId: crypto.randomUUID(),
        targetResumeId,
        toolName: 'canvas_change_history',
      },
      async (run) => {
        if (
          useUserStore.getState().currentUser?.id !== ownerId ||
          useAssistantStore.getState().activeConversationId !==
            state.activeConversationId
        )
          return

        useAssistantStore.setState({
          runPhase: 'applying',
          abortController: run.controller,
        })

        try {
          await work()
        } finally {
          if (
            useAssistantStore.getState().abortController === run.controller ||
            !useAssistantStore.getState().abortController
          )
            useAssistantStore.setState({
              runPhase: 'idle',
              abortController: null,
            })
        }
      },
    ),
  )
}
