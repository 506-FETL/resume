import { useEffect } from 'react'
import type { AiConversation } from '@/lib/ai/types'
import type { ListMessagesResult } from '@/lib/supabase/ai/messages'
import { getErrorMessage } from '@/utils'
import useAssistantStore, { cancelActiveAssistantRun } from '../store'
import {
  readLastConversationId,
  writeLastConversationId,
} from '../utils/storage'
import {
  applyAssistantConversationPage,
  consumeAssistantPreload,
  loadAssistantConversations,
  loadAssistantMessages,
  loadConversationSummary,
  useConversationReadScope,
} from './conversation-reads'

export function useAssistantBootstrap() {
  const scope = useConversationReadScope()
  const attempt = useAssistantStore((state) => state.bootstrapAttempt)

  useEffect(() => {
    const initial = useAssistantStore.getState()
    const prepared = consumeAssistantPreload()
    const owner = scope.owner
    let live = true

    const ownsAccount = () =>
      live && scope === useConversationReadScope.getState()

    const ownsView = () =>
      ownsAccount() &&
      initial.conversationViewVersion ===
        useAssistantStore.getState().conversationViewVersion &&
      initial.conversationLoadRequestId ===
        useAssistantStore.getState().conversationLoadRequestId

    const preserve =
      initial.bootstrapGeneration === scope.generation &&
      (!initial.loadingMessages ||
        (initial.pendingConversationId === initial.activeConversationId &&
          !initial.conversationLoadRequestId)) &&
      (!initial.bootstrapError || initial.bootstrapError.preserveView === true)

    const retry = initial.bootstrapError?.conversationId

    let target =
      retry ?? initial.activeConversationId ?? readLastConversationId()

    const keepBlank = preserve && !retry && !initial.activeConversationId
    let failedTarget: string | null = null

    useAssistantStore.setState({
      bootstrapError: null,
      initializing: !preserve,
      ...(!preserve && { messages: [], historicalMatch: null }),
      loadingConversations: !retry,
      ...(!retry && { conversationListError: false }),
    })

    async function readList() {
      if (!owner) throw new Error('用户未登录')
      if (prepared) await prepared.list

      const page = await loadAssistantConversations(owner)

      if (!ownsAccount()) return page

      applyAssistantConversationPage(page, preserve)

      if (
        target &&
        ownsView() &&
        useAssistantStore.getState().initializing &&
        page.conversations.some((item) => item.id === target)
      )
        useAssistantStore.setState({
          pendingConversationId: target,
          loadingMessages: true,
        })

      return page
    }

    const list = retry ? undefined : readList()

    list?.catch(() => {
      if (ownsAccount())
        useAssistantStore.setState({
          loadingConversations: false,
          conversationListError: true,
        })
    })

    const complete = () => {
      useAssistantStore.setState({
        initializing: false,
        bootstrapGeneration: scope.generation,
      })
    }

    async function show(
      conversation: AiConversation,
      page?: ListMessagesResult,
    ) {
      if (!ownsView() || !owner) return

      failedTarget = conversation.id

      if (!useAssistantStore.getState().conversations.includes(conversation))
        useAssistantStore.getState().upsertConversation(conversation)

      useAssistantStore.setState({
        pendingConversationId: conversation.id,
        loadingMessages: true,
      })

      const { messages, hasMore } =
        page ?? (await loadAssistantMessages(conversation.id))

      if (!ownsView()) return

      const current = useAssistantStore.getState()

      const unchanged = messages.length
        ? initial.messages.at(-messages.length) === messages[0]
        : initial.messages.length === 0

      if (
        preserve &&
        conversation.id === initial.activeConversationId &&
        (current.streaming ||
          current.messages !== initial.messages ||
          unchanged)
      ) {
        useAssistantStore.setState({
          loadingMessages: false,
          pendingConversationId: null,
        })
      } else {
        current.setConversationView(conversation.id, messages, { hasMore })
      }

      writeLastConversationId(conversation.id)
      complete()
    }

    async function load() {
      if (!owner) throw new Error('用户未登录')
      if (keepBlank) {
        complete()

        return
      }

      // 已记录在本账户下的 ID 可一次取到 RLS 核对过的会话和正文，空会话也有父行。
      if (target) {
        failedTarget = target

        const known = initial.conversations.find((item) => item.id === target)

        if (known) {
          useAssistantStore.setState({
            pendingConversationId: known.id,
            loadingMessages: true,
          })
        }

        if (prepared?.target === target) await prepared.messages

        const page = await loadAssistantMessages(target, owner)

        if (!ownsView()) return

        const conversation =
          page.conversation === undefined
            ? (known ?? (await loadConversationSummary(owner, target)))
            : page.conversation

        if (conversation) {
          await show(conversation, page)

          return
        }

        if (ownsView())
          useAssistantStore.getState().removeConversationLocal(target)
      }

      failedTarget = null

      const page = await (list ?? readList())

      if (!ownsView()) return

      // 旧版只保存一个全局 ID，先在当前账户内验证归属。
      target = !target ? readLastConversationId(true) : null

      let restored = page.conversations.find((item) => item.id === target)

      if (!restored && target && page.next) {
        failedTarget = target
        restored = (await loadConversationSummary(owner, target)) ?? undefined
      }

      if (!ownsView()) return

      restored ??= page.conversations[0]

      if (restored) {
        await show(restored)

        return
      }

      useAssistantStore.getState().setConversationView(null, [], {})
      complete()
    }

    load().catch((error: unknown) => {
      if (!ownsView()) return

      useAssistantStore.setState({
        initializing: false,
        loadingMessages: false,
        pendingConversationId: null,
        bootstrapError: {
          message: getErrorMessage(error),
          conversationId: failedTarget,
          preserveView: Boolean(
            preserve &&
            (!failedTarget || initial.activeConversationId === failedTarget),
          ),
        },
      })
    })

    return () => {
      live = false
      cancelActiveAssistantRun()
    }
  }, [scope, attempt])
}
