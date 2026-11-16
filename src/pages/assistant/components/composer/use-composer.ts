import { useShallow } from 'zustand/react/shallow'
import { useId, useRef, useState } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useComposerUploads } from '../../hooks/use-composer-uploads'
import { ASSISTANT_TOOLS } from '../composer-tools'
import { ASSISTANT_COMMANDS } from '@/lib/ai/commands'
import { createSkillReferences } from '@/lib/ai/skills/references'
import type { AiUserReference } from '@/lib/ai/types'
import { useSourceScope } from '../../hooks/use-source-scope'
import { freezeSourceScope } from '../../store/source-scope'
import { useChatStream } from '../../hooks/use-chat-stream'
import { useComposerContext } from '../../hooks/use-composer-context'
import useAssistantStore from '../../store'
import type { ComposerKeyDownEvent, ComposerTool } from '../../types'

export function useComposer() {
  const {
    streaming,
    composerDraft: draft,
    composerReferences: references,
    pendingConfirm,
    confirmationFeedback,
    runPhase,
    draftStorageFailed,
    initializing,
    bootstrapError,
    loadingMessages,
    deepThinking,
    setDeepThinking,
    activeConversationId,
    queuedMessages,
    pendingAssistantWrite,
    pendingMessageUpdates,
  } = useAssistantStore(
    useShallow((state) => ({
      streaming: state.streaming,
      composerDraft: state.composerDraft,
      composerReferences: state.composerReferences,
      pendingConfirm: state.pendingConfirm,
      confirmationFeedback: state.confirmationFeedback,
      runPhase: state.runPhase,
      draftStorageFailed: state.draftStorageFailed,
      initializing: state.initializing,
      bootstrapError: state.bootstrapError,
      loadingMessages: state.loadingMessages,
      deepThinking: state.deepThinking,
      setDeepThinking: state.setDeepThinking,
      activeConversationId: state.activeConversationId,
      queuedMessages: state.queuedMessages,
      pendingAssistantWrite: state.pendingAssistantWrite,
      pendingMessageUpdates: state.pendingMessageUpdates,
    })),
  )

  const { sendMessage, stopStreaming, compactContext } = useChatStream()
  const uploads = useComposerUploads()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sendStatusId = useId()
  const context = useComposerContext()
  const sourceScope = useSourceScope()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const commandRef = useRef<HTMLDivElement>(null)
  const thinkingRef = useRef<HTMLButtonElement>(null)
  const composingRef = useRef(false)
  const [manualToolsOpen, setManualToolsOpen] = useState(false)
  const [commandDismissed, setCommandDismissed] = useState(false)
  const [menuQuery, setMenuQuery] = useState('')

  const [newTaskProposalId, setNewTaskProposalId] = useState<string | null>(
    null,
  )

  const reduceMotion = useReducedMotion()

  const disabled = initializing || loadingMessages || Boolean(bootstrapError)

  const hasExplicitSources = references.some(
    (reference) =>
      reference.type === 'reference' && reference.kind === 'experience',
  )

  const composerSources = hasExplicitSources
    ? freezeSourceScope(sourceScope.sources ?? [], references)
    : sourceScope.sources

  const running =
    streaming ||
    [
      'preparing',
      'generating',
      'confirming',
      'applying',
      'compacting',
    ].includes(runPhase)

  const awaiting = pendingConfirm?.status === 'pending'
  const asNewTask = awaiting && newTaskProposalId === pendingConfirm.id
  const replying = awaiting && !asNewTask
  const visibleDraft = replying ? confirmationFeedback : draft

  const queryMode = visibleDraft.startsWith('/') || visibleDraft.startsWith('$')
  const query = queryMode ? visibleDraft.slice(1) : menuQuery

  const toolsOpen =
    !disabled && (manualToolsOpen || (queryMode && !commandDismissed))

  const compactDisabled =
    disabled ||
    runPhase !== 'idle' ||
    !activeConversationId ||
    !composerSources ||
    Boolean(pendingConfirm || pendingAssistantWrite) ||
    queuedMessages.length > 0 ||
    pendingMessageUpdates.length > 0

  const tools = ASSISTANT_TOOLS.filter((tool) => {
    const searchable = [
      tool.name,
      tool.displayName,
      tool.description,
      ...(tool.aliases ?? []),
    ]

    return (
      (!visibleDraft.startsWith('$') || Boolean(tool.skillId)) &&
      searchable.some((value) =>
        value?.toLowerCase().includes(query.toLowerCase()),
      )
    )
  }).map((tool) =>
    tool.action === 'compact-context'
      ? { ...tool, disabled: compactDisabled }
      : tool,
  )

  const canSend = Boolean(
    visibleDraft.trim() || (!replying && references.length),
  )

  const sendBlockedReason = uploads.tasks.length
    ? uploads.tasks.some((task) => ['failed', 'unknown'].includes(task.status))
      ? '文件还未准备好，请重试或移除后再发送。'
      : '文件正在上传，完成后就可以发送。'
    : undefined

  const sendDisabled =
    disabled || !canSend || Boolean(sendBlockedReason) || !composerSources

  const closeTools = () => {
    setManualToolsOpen(false)
    setCommandDismissed(true)
  }

  const focusDraft = () => {
    const input = textareaRef.current

    input?.focus({ preventScroll: true })

    requestAnimationFrame(() => {
      if (input && document.activeElement === input)
        input.setSelectionRange(input.value.length, input.value.length)
    })
  }

  const appendDraft = (reference: AiUserReference) => {
    useAssistantStore.getState().addComposerReferences([reference])
  }

  const handleToolSelect = (tool: ComposerTool) => {
    const state = useAssistantStore.getState()

    closeTools()
    focusDraft()

    if (tool.action === 'compact-context') {
      if (!compactContext()) return
    } else if (tool.skillId)
      state.addComposerReferences(createSkillReferences('', [tool.skillId]))
    else {
      const command = ASSISTANT_COMMANDS.find(
        (item) => item.displayName === tool.name,
      )

      if (command)
        state.addComposerReferences([
          {
            type: 'reference',
            kind: 'command',
            id: command.id,
            version: command.version,
            label: command.displayName,
          },
        ])
    }

    if (/^[$/]\S*$/.test(visibleDraft.trim())) {
      if (replying) state.setConfirmationFeedback('')
      else state.setComposerDraft('')
    }
  }

  const submit = (
    mode: 'queue' | 'interrupt' | 'feedback' = replying ? 'feedback' : 'queue',
  ) => {
    if (sendDisabled || composingRef.current) return

    if (sendMessage(visibleDraft.trim(), references, mode)) {
      useAssistantStore.setState({
        ...(replying ? { confirmationFeedback: '' } : { composerDraft: '' }),
        composerReferences: [],
        composerSkillIds: [],
        composerLibrarySources: null,
      })

      setNewTaskProposalId(null)
      closeTools()
    }
  }

  const handleKeyDown = (event: ComposerKeyDownEvent) => {
    if (
      composingRef.current ||
      event.nativeEvent.isComposing ||
      event.keyCode === 229
    )
      return

    if (toolsOpen && event.key === 'Escape') {
      event.preventDefault()
      closeTools()

      return
    }
    if (
      toolsOpen &&
      (event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        (event.key === 'Enter' && !event.shiftKey && tools.length > 0))
    ) {
      event.preventDefault()

      commandRef.current?.dispatchEvent(
        new KeyboardEvent('keydown', { key: event.key, bubbles: true }),
      )

      return
    }
    if (
      event.key === 'Enter' &&
      event.shiftKey &&
      (event.metaKey || event.ctrlKey)
    ) {
      event.preventDefault()
      submit('interrupt')

      return
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return {
    streaming,
    references,
    pendingConfirm,
    runPhase,
    draftStorageFailed,
    deepThinking,
    setDeepThinking,
    stopStreaming,
    uploads,
    fileInputRef,
    sendStatusId,
    context,
    sourceScope,
    textareaRef,
    commandRef,
    thinkingRef,
    composingRef,
    setManualToolsOpen,
    setCommandDismissed,
    setMenuQuery,
    setNewTaskProposalId,
    reduceMotion,
    disabled,
    hasExplicitSources,
    running,
    awaiting,
    asNewTask,
    replying,
    visibleDraft,
    queryMode,
    query,
    toolsOpen,
    tools,
    canSend,
    sendBlockedReason,
    sendDisabled,
    closeTools,
    focusDraft,
    appendDraft,
    handleToolSelect,
    submit,
    handleKeyDown,
  }
}
