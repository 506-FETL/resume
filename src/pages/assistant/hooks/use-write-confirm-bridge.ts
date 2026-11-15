import { useEffect } from 'react'
import { setConfirmHandler } from '@/lib/ai/agent/confirm-bridge'
import type { ConfirmDecision } from '@/lib/ai/agent/confirm-bridge'
import useAssistantStore from '../store'

export function useWriteConfirmBridge() {
  useEffect(() => {
    let cancelActiveConfirm: (() => void) | null = null

    setConfirmHandler(
      (request, signal) =>
        new Promise((resolve) => {
          let settled = false
          let onAbort: () => void = () => {}

          let cancel = () => {}

          const finish = (decision: ConfirmDecision) => {
            if (settled) return

            settled = true
            signal?.removeEventListener('abort', onAbort)

            if (cancelActiveConfirm === cancel) cancelActiveConfirm = null
            if (
              useAssistantStore.getState().pendingConfirm?.id === request.id
            ) {
              if (decision.kind === 'accept')
                useAssistantStore.setState((state) => ({
                  pendingConfirm: state.pendingConfirm
                    ? { ...state.pendingConfirm, status: 'applying' }
                    : null,
                }))
              else useAssistantStore.getState().setPendingConfirm(null)
            }

            useAssistantStore.setState({
              runPhase: decision.kind === 'accept' ? 'applying' : 'generating',
              confirmationFeedback: '',
            })

            resolve(decision)
          }

          onAbort = () => finish({ kind: 'reject' })
          cancel = () => finish({ kind: 'reject' })

          if (signal?.aborted) {
            finish({ kind: 'reject' })

            return
          }

          // eslint-disable-next-line @eslint-react/web-api/no-leaked-event-listener -- finish 和 effect cleanup 均会移除当前请求监听器。
          signal?.addEventListener('abort', onAbort, { once: true })
          cancelActiveConfirm = cancel

          useAssistantStore.setState({
            runPhase: 'confirming',
            confirmationFeedback: '',
          })

          useAssistantStore.getState().setPendingConfirm({
            id: request.id,
            toolName: request.toolName,
            preview: request.preview,
            status: 'pending',
            resolve: finish,
          })
        }),
      (id, status, result) => {
        const current = useAssistantStore.getState()

        if (current.pendingConfirm?.id !== id) return
        if (status === 'cancelled') {
          current.setPendingConfirm(null)

          return
        }

        useAssistantStore.setState({
          pendingConfirm: { ...current.pendingConfirm, status, result },
          runPhase: status === 'applying' ? 'applying' : 'generating',
        })
      },
    )

    return () => {
      cancelActiveConfirm?.()
      setConfirmHandler(null)
    }
  }, [])
}
