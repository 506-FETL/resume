import { useCallback } from 'react'
import { cancelActiveAssistantRun } from '../../store'
import { interruption } from './interruption'
import { useRunSend } from './use-run-send'
import { useQueueDrain } from './use-queue-drain'
import { useSendActions } from './use-send-actions'
import { useCompaction } from './use-compaction'
import { useQueueActions } from './use-queue-actions'
import { useHistoryActions } from './use-history-actions'

export function useChatStream() {
  const runSend = useRunSend()
  const drainQueue = useQueueDrain(runSend)
  const { sendMessage, reviseConfirmation } = useSendActions(drainQueue)
  const compactContext = useCompaction(drainQueue)
  const { resumeQueue, sendQueuedNow } = useQueueActions(drainQueue)

  const { retryLast, regenerateFrom, editUserMessageAndRerun } =
    useHistoryActions(runSend, drainQueue)

  const stopStreaming = useCallback(() => {
    interruption.continueAfterInterruption = false
    cancelActiveAssistantRun()
  }, [])

  return {
    sendMessage,
    compactContext,
    resumeQueue,
    sendQueuedNow,
    reviseConfirmation,
    retryLast,
    regenerateFrom,
    editUserMessageAndRerun,
    stopStreaming,
  }
}
