import { useState } from 'react'
import type { AiMessage } from '@/lib/ai/types'

export function useMessageRowKeys(messages: AiMessage[]) {
  const [identity, setIdentity] = useState(() => ({
    messages,
    keys: createMessageRowKeys(messages),
  }))

  if (identity.messages !== messages) {
    const next = {
      messages,
      keys: createMessageRowKeys(messages, identity.keys),
    }

    setIdentity(next)

    return next.keys
  }

  return identity.keys
}

function createMessageRowKeys(
  messages: AiMessage[],
  previousKeys?: Map<string, string>,
) {
  return new Map(
    messages.map((message, index) => {
      const previousMessage = messages[index - 1]

      // 分页首条可能是回复；补入前驱后仍保留它第一次出现时的身份。
      const key =
        previousKeys?.get(message.id) ??
        (message.role === 'assistant' && previousMessage
          ? `reply-${previousMessage.id}`
          : message.id)

      return [message.id, key]
    }),
  )
}
