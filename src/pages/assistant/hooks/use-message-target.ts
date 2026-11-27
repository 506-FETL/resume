import type { RefObject } from 'react'
import { useEffect, useState } from 'react'
import { useMessageScroller } from '@/components/ui/message-scroller'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import {
  CONVERSATION_BOTTOM_TARGET,
  MESSAGE_HIGHLIGHT_DURATION_MS,
} from '../const'
import type { MessageViewSnapshot } from '../components/message-list/types'
import useAssistantStore from '../store'

export function useMessageTarget(
  snapshot: MessageViewSnapshot,
  viewportRef: RefObject<HTMLDivElement | null>,
  isPresent: boolean,
) {
  const {
    activeConversationId,
    conversationViewVersion,
    messages,
    setTargetMessageId,
    targetMessageId,
  } = snapshot

  const shouldReduceMotion = useReducedMotion()
  const { scrollToEnd, scrollToMessage } = useMessageScroller()

  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null)

  useEffect(() => {
    if (!isPresent || !targetMessageId) return

    const ownsTarget = () =>
      isCurrentMessageView(conversationViewVersion, activeConversationId) &&
      useAssistantStore.getState().targetMessageId === targetMessageId

    if (!ownsTarget()) return

    if (targetMessageId === CONVERSATION_BOTTOM_TARGET) {
      if (scrollToEnd({ behavior: 'instant' })) setTargetMessageId(null)

      return
    }

    const viewport = viewportRef.current

    if (!viewport) return

    let frame: number | undefined
    let timer: number | undefined

    const locate = () => {
      if (!ownsTarget() || frame !== undefined) return

      const target = viewport.querySelector(
        `[data-message-id="${CSS.escape(targetMessageId)}"]`,
      )

      // 同批正文仍在加载时，先展示的纯文本与最终排版高度可能不同。
      if (!target || viewport.querySelector('[data-assistant-text-loading]'))
        return

      const textParts = target.querySelectorAll('[data-assistant-text-part]')

      // 目标的错误边界保留重试，但其他已失败的消息不阻塞本条定位。
      if (
        Array.from(textParts).some(
          (part) => !part.querySelector('[data-assistant-text-ready]'),
        )
      )
        return

      frame = window.requestAnimationFrame(() => {
        frame = undefined

        if (!ownsTarget()) return
        if (
          !scrollToMessage(targetMessageId, {
            align: 'center',
            behavior: shouldReduceMotion ? 'instant' : 'smooth',
          })
        )
          return

        observer.disconnect()
        setHighlightedMessageId(targetMessageId)

        timer = window.setTimeout(() => {
          if (ownsTarget()) setTargetMessageId(null)
        }, MESSAGE_HIGHLIGHT_DURATION_MS)
      })
    }

    const observer = new MutationObserver(locate)

    observer.observe(viewport, { childList: true, subtree: true })
    locate()

    return () => {
      observer.disconnect()

      if (frame !== undefined) window.cancelAnimationFrame(frame)
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [
    activeConversationId,
    conversationViewVersion,
    isPresent,
    messages,
    setTargetMessageId,
    shouldReduceMotion,
    scrollToEnd,
    scrollToMessage,
    targetMessageId,
    viewportRef,
  ])

  return highlightedMessageId
}

export function isCurrentMessageView(
  version: number,
  conversationId: string | null,
) {
  const current = useAssistantStore.getState()

  return (
    current.conversationViewVersion === version &&
    current.activeConversationId === conversationId &&
    !current.initializing &&
    !current.loadingMessages
  )
}
