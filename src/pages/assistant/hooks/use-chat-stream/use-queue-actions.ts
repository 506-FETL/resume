import type { useQueueDrain } from './use-queue-drain'
import { interruption } from './interruption'
import { useCallback } from 'react'
import { assistantRunner as runner } from '../../runtime/assistant-run'
import useAssistantStore from '../../store'

export function useQueueActions(drainQueue: ReturnType<typeof useQueueDrain>) {
  const resumeQueue = useCallback(() => {
    useAssistantStore.setState({ queuePaused: false })
    drainQueue()
  }, [drainQueue])

  const sendQueuedNow = useCallback(
    (id: string) => {
      const state = useAssistantStore.getState()
      const item = state.queuedMessages.find((message) => message.id === id)

      if (!item) return

      useAssistantStore.setState({
        queuedMessages: [
          item,
          ...state.queuedMessages.filter((message) => message.id !== id),
        ],
        queuePaused: false,
      })

      if (runner.busy) {
        interruption.continueAfterInterruption = true
        state.abortController?.abort()
        useAssistantStore.setState({ runPhase: 'settling' })
      }

      drainQueue()
    },
    [drainQueue],
  )

  return { resumeQueue, sendQueuedNow }
}
