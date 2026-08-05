import { useEffect } from 'react'
import { setConfirmHandler } from '@/lib/ai/agent/confirm-bridge'
import { getErrorMessage } from '@/utils'
import useAssistantStore from '../store'

export function useWriteConfirmBridge() {
  useEffect(() => {
    setConfirmHandler(request => new Promise((resolve) => {
      useAssistantStore.getState().setPendingConfirm({
        id: request.id,
        toolName: request.toolName,
        preview: request.preview,
        resolve: async (confirmed) => {
          useAssistantStore.getState().setPendingConfirm(null)
          if (!confirmed) {
            resolve({ confirmed: false })
            return
          }

          try {
            resolve({ confirmed: true, result: await request.apply() })
          }
          catch (error) {
            resolve({ confirmed: true, result: { error: getErrorMessage(error) } })
          }
        },
      })
    }))

    return () => setConfirmHandler(null)
  }, [])
}
