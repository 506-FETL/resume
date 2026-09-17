import { useEffect } from 'react'
import { setConfirmHandler } from '@/lib/ai/agent/confirm-bridge'
import useAssistantStore from '../store'

export function useWriteConfirmBridge() {
  useEffect(() => {
    let cancelActiveConfirm: (() => void) | null = null
    setConfirmHandler((request, signal) => new Promise((resolve) => {
      let settled = false
      let onAbort: () => void = () => {}
      let cancel = () => {}
      const finish = (confirmed: boolean) => {
        if (settled)
          return
        settled = true
        signal?.removeEventListener('abort', onAbort)
        if (cancelActiveConfirm === cancel)
          cancelActiveConfirm = null
        if (useAssistantStore.getState().pendingConfirm?.id === request.id)
          useAssistantStore.getState().setPendingConfirm(null)
        resolve({ confirmed })
      }
      onAbort = () => finish(false)
      cancel = () => finish(false)
      if (signal?.aborted) {
        finish(false)
        return
      }
      // eslint-disable-next-line react-web-api/no-leaked-event-listener -- finish 和 effect cleanup 均会移除当前请求监听器。
      signal?.addEventListener('abort', onAbort, { once: true })
      cancelActiveConfirm = cancel
      useAssistantStore.getState().setPendingConfirm({
        id: request.id,
        toolName: request.toolName,
        preview: request.preview,
        resolve: finish,
      })
    }))

    return () => {
      cancelActiveConfirm?.()
      setConfirmHandler(null)
    }
  }, [])
}
