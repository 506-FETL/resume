import { executeSend } from './execute-send'
import type { AiMessage, AiUserReference } from '@/lib/ai/types'
import { useCallback } from 'react'
import type { AssistantSubmission } from '../../store/composer-slice'
import { resolveActiveResumeId } from '@/lib/ai/active-resume'
import { executeAssistantRun } from '../../runtime/assistant-run'
import {
  getDraftRecoveryEpoch,
  getAssistantAccountGeneration,
} from '../../store/composer-sessions'
import useUserStore from '@/store/user'
import useAssistantStore from '../../store'

export function useRunSend() {
  const runSend = useCallback(
    (
      text: string,
      references: AiUserReference[] = [],
      boundary?: AiMessage,
      submission?: AssistantSubmission,
    ) => {
      const state = useAssistantStore.getState()
      const ownerId = useUserStore.getState().currentUser?.id

      if (!ownerId) return Promise.resolve('paused' as const)

      return executeAssistantRun(
        {
          ownerId,
          recoveryEpoch: getDraftRecoveryEpoch(ownerId),
          accountGeneration: getAssistantAccountGeneration(),
          conversationId: state.activeConversationId,
          submissionId: submission?.id ?? crypto.randomUUID(),
          targetResumeId: submission
            ? submission.targetResumeId
            : resolveActiveResumeId(),
        },
        (run) => executeSend(text, references, boundary, submission, run),
      )
    },
    [],
  )

  return runSend
}
