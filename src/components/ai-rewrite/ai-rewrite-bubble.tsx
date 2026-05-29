'use client'

import type { Editor } from '@tiptap/react'
import type { RewriteAction, RewriteCandidate, RewriteFieldContext, RewriteSelection } from './types'
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu'
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { AiRewritePanel } from './ai-rewrite-panel'
import { JD_MIN_CHARS, REWRITE_ACTION_META, SELECTION_MIN_CHARS } from './const'
import { RewriteBubbleMenu } from './rewrite-bubble-menu'
import { RewriteDialogShell } from './rewrite-dialog-shell'
import { RewritePanelFooter } from './rewrite-panel-footer'
import { getRewriteCanRetry } from './rewrite-session-state'
import { useAiRewrite } from './use-ai-rewrite'
import { useRewriteSelection } from './use-rewrite-selection'
import './ai-rewrite.scss'

interface Props {
  editor: Editor
  fieldContext: RewriteFieldContext
}

const BUBBLE_MENU_PLUGIN_KEY = 'aiRewriteBubbleMenu'

export function AiRewriteBubble({ editor, fieldContext }: Props) {
  const { state, run, setJdDraft, reset, retry, cancel, waitForJd } = useAiRewrite({ fieldContext })
  const [bubbleEl, setBubbleEl] = useState<HTMLDivElement | null>(null)
  const [savedSelection, setSavedSelection] = useState<RewriteSelection | null>(null)
  const readSelection = useRewriteSelection(editor)

  const activeSelection = state.status === 'idle' ? null : savedSelection
  const dialogOpen = state.status !== 'idle'
  const action = state.action
  const meta = action ? REWRITE_ACTION_META[action] : null
  const HeaderIcon = meta?.icon
  const title = meta ? `${meta.label}候选` : 'AI 改写候选'
  const description = meta ? `${meta.description}；选择满意的版本点击「应用」即可替换原文。` : undefined
  const canRetry = getRewriteCanRetry(state, JD_MIN_CHARS)

  // 创建 BubbleMenu 的原生 DOM 容器（Tiptap 的 BubbleMenuPlugin API
  // 需要直接传入 element，无 shadcn 等价物，故保留此最小原生容器）
  useEffect(() => {
    const bubble = document.createElement('div')
    bubble.className = 'tiptap-toolbar ai-rewrite-bubble'
    document.body.appendChild(bubble)
    setBubbleEl(bubble)
    return () => {
      bubble.remove()
    }
  }, [])

  // 通过公共 API 注册 BubbleMenu 的 ProseMirror 插件
  useEffect(() => {
    if (!editor || !bubbleEl)
      return
    const plugin = BubbleMenuPlugin({
      editor,
      element: bubbleEl,
      pluginKey: BUBBLE_MENU_PLUGIN_KEY,
      shouldShow: ({ editor: ed, from, to }) => {
        if (from === to)
          return false
        return ed.state.doc.textBetween(from, to).trim().length >= SELECTION_MIN_CHARS
      },
    })
    editor.registerPlugin(plugin)
    return () => {
      editor.unregisterPlugin(BUBBLE_MENU_PLUGIN_KEY)
    }
  }, [editor, bubbleEl])

  const handleClose = useCallback(() => {
    cancel()
    reset()
    setSavedSelection(null)
  }, [cancel, reset])

  const handleAction = useCallback((nextAction: RewriteAction) => {
    const sel = readSelection()
    if (!sel)
      return
    setSavedSelection(sel)
    if (nextAction === 'align_jd' && state.jdDraft.trim().length < JD_MIN_CHARS) {
      waitForJd()
      return
    }
    run(nextAction, sel)
  }, [readSelection, run, state.jdDraft, waitForJd])

  const handleApply = useCallback((candidate: RewriteCandidate) => {
    if (!savedSelection)
      return
    editor
      .chain()
      .focus()
      .insertContentAt({ from: savedSelection.from, to: savedSelection.to }, candidate.html)
      .run()
    toast.success('已应用 AI 改写')
    reset()
    setSavedSelection(null)
  }, [editor, savedSelection, reset])

  const handleRetry = useCallback(() => {
    if (savedSelection)
      retry(savedSelection)
  }, [retry, savedSelection])

  return (
    <>
      {bubbleEl && createPortal(
        <RewriteBubbleMenu onAction={handleAction} />,
        bubbleEl,
      )}

      <RewriteDialogShell
        open={dialogOpen}
        onOpenChange={open => !open && handleClose()}
        title={title}
        description={description}
        icon={HeaderIcon}
        footer={(
          <RewritePanelFooter
            canRetry={canRetry}
            isStreaming={state.status === 'streaming'}
            onRetry={handleRetry}
          />
        )}
      >
        <AiRewritePanel
          state={state}
          selection={activeSelection}
          onApply={handleApply}
          onJdDraftChange={setJdDraft}
        />
      </RewriteDialogShell>
    </>
  )
}
