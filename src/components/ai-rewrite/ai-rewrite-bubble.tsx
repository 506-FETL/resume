'use client'

import type { Editor } from '@tiptap/react'
import type {
  RewriteAction,
  RewriteCandidate,
  RewriteFieldContext,
  RewriteSelection,
} from './types'
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu'
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { AiRewritePanel } from './ai-rewrite-panel'
import { RewriteBubbleMenu } from './components/bubble-menu'
import { RewriteDialogShell } from './components/dialog-shell'
import { RewritePanelFooter } from './components/panel-footer'
import { JD_MIN_CHARS, REWRITE_ACTION_META, SELECTION_MIN_CHARS } from './const'
import { useAiRewrite } from './hooks/use-ai-rewrite'
import { getBubbleDisplayMode } from './utils/bubble-positioning'
import { createSelectionVirtualElement } from './utils/create-selection-virtual-element'
import { readRewriteSelection } from './utils/read-rewrite-selection'
import { getRewriteCanRetry } from './utils/rewrite-session-state'
import './ai-rewrite.scss'

interface Props {
  editor: Editor
  fieldContext: RewriteFieldContext
}

const BUBBLE_MENU_PLUGIN_KEY = 'aiRewriteBubbleMenu'
const BUBBLE_BOUNDARY_PADDING = 8
const COMPACT_BUBBLE_WIDTH = 42

export function AiRewriteBubble({ editor, fieldContext }: Props) {
  const { state, run, setJdDraft, reset, retry, cancel, waitForJd } = useAiRewrite({ fieldContext })
  const [bubbleEl, setBubbleEl] = useState<HTMLDivElement | null>(null)
  const [measureEl, setMeasureEl] = useState<HTMLDivElement | null>(null)
  const [boundaryEl, setBoundaryEl] = useState<HTMLElement | null>(null)
  const [fullMenuWidth, setFullMenuWidth] = useState(0)
  const [availableWidth, setAvailableWidth] = useState(0)
  const [savedSelection, setSavedSelection] = useState<RewriteSelection | null>(null)
  const bubbleMode = fullMenuWidth > 0
    ? getBubbleDisplayMode({
        availableWidth,
        fullWidth: fullMenuWidth,
        compactWidth: COMPACT_BUBBLE_WIDTH,
      })
    : 'hidden'

  const activeSelection = state.status === 'idle' ? null : savedSelection
  const dialogOpen = state.status !== 'idle'
  const action = state.action
  const meta = action ? REWRITE_ACTION_META[action] : null
  const HeaderIcon = meta?.icon
  const title = meta ? `${meta.label}候选` : 'AI 改写候选'
  const description = meta ? `${meta.description}；选择满意的版本点击「应用」即可替换原文。` : undefined
  const canRetry = getRewriteCanRetry(state, JD_MIN_CHARS)

  // TipTap 要求直接传入宿主元素；独立测量宿主避免首次定位时测量空节点。
  useEffect(() => {
    const bubble = document.createElement('div')
    const measure = document.createElement('div')

    bubble.className = 'ai-rewrite-bubble'
    measure.className = 'ai-rewrite-bubble-measure'
    measure.ariaHidden = 'true'
    measure.inert = true
    document.body.append(bubble, measure)
    setBubbleEl(bubble)
    setMeasureEl(measure)

    return () => {
      bubble.remove()
      measure.remove()
    }
  }, [])

  useEffect(() => {
    const boundary = editor.view.dom.closest<HTMLElement>(
      '.simple-editor-content',
    ) ?? editor.view.dom.parentElement
    setBoundaryEl(boundary)
    if (!boundary)
      return

    const updateAvailableWidth = () => {
      setAvailableWidth(Math.max(
        0,
        boundary.getBoundingClientRect().width
        - BUBBLE_BOUNDARY_PADDING * 2,
      ))
    }
    const observer = new ResizeObserver(updateAvailableWidth)
    observer.observe(boundary)
    updateAvailableWidth()

    return () => {
      observer.disconnect()
    }
  }, [editor])

  const handleFullWidthChange = useCallback((width: number) => {
    setFullMenuWidth(current => (
      Math.abs(current - width) < 0.5 ? current : width
    ))
  }, [])

  const updateBubblePosition = useCallback(() => {
    if (editor.isDestroyed)
      return

    editor.view.dispatch(
      editor.state.tr.setMeta(BUBBLE_MENU_PLUGIN_KEY, 'updatePosition'),
    )
  }, [editor])

  // 通过公共 API 注册 BubbleMenu 的 ProseMirror 插件。
  useEffect(() => {
    if (!bubbleEl || !boundaryEl || bubbleMode === 'hidden')
      return

    const plugin = BubbleMenuPlugin({
      editor,
      element: bubbleEl,
      pluginKey: BUBBLE_MENU_PLUGIN_KEY,
      appendTo: () => document.body,
      getReferencedVirtualElement: () => (
        createSelectionVirtualElement(editor, boundaryEl)
      ),
      options: {
        strategy: 'fixed',
        placement: 'top',
        offset: 12,
        flip: {
          boundary: boundaryEl,
          padding: BUBBLE_BOUNDARY_PADDING,
          fallbackPlacements: ['bottom'],
        },
        shift: {
          boundary: boundaryEl,
          padding: BUBBLE_BOUNDARY_PADDING,
          crossAxis: true,
        },
        size: {
          boundary: boundaryEl,
          padding: BUBBLE_BOUNDARY_PADDING,
          apply: ({ availableWidth: width, elements }) => {
            elements.floating.style.maxWidth = `${Math.max(0, width)}px`
          },
        },
        hide: {
          boundary: boundaryEl,
          padding: 0,
        },
        inline: true,
        scrollTarget: boundaryEl,
      },
      shouldShow: ({ editor: ed, from, to }) => {
        if (from === to)
          return false

        return (
          ed.state.doc.textBetween(from, to).trim().length
          >= SELECTION_MIN_CHARS
        )
      },
    })

    editor.registerPlugin(plugin)

    return () => {
      editor.unregisterPlugin(BUBBLE_MENU_PLUGIN_KEY)
    }
  }, [boundaryEl, bubbleEl, bubbleMode, editor])

  useEffect(() => {
    if (bubbleMode === 'hidden')
      return

    const frame = requestAnimationFrame(updateBubblePosition)
    return () => cancelAnimationFrame(frame)
  }, [
    availableWidth,
    bubbleMode,
    fullMenuWidth,
    updateBubblePosition,
  ])

  useEffect(() => {
    if (!boundaryEl || bubbleMode === 'hidden')
      return

    let frame = 0
    const schedulePositionUpdate = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(updateBubblePosition)
    }
    window.addEventListener('scroll', schedulePositionUpdate, true)

    return () => {
      window.removeEventListener('scroll', schedulePositionUpdate, true)
      cancelAnimationFrame(frame)
    }
  }, [boundaryEl, bubbleMode, updateBubblePosition])

  function handleClose() {
    cancel()
    reset()
    setSavedSelection(null)
  }

  function handleAction(nextAction: RewriteAction) {
    const sel = readRewriteSelection(editor)

    if (!sel)
      return

    setSavedSelection(sel)

    if (
      nextAction === 'align_jd'
      && state.jdDraft.trim().length < JD_MIN_CHARS
    ) {
      waitForJd()
      return
    }

    run(nextAction, sel)
  }

  function handleApply(candidate: RewriteCandidate) {
    if (!savedSelection)
      return

    editor
      .chain()
      .focus()
      .insertContentAt(
        { from: savedSelection.from, to: savedSelection.to },
        candidate.html,
      )
      .run()

    toast.success('已应用 AI 改写')
    reset()
    setSavedSelection(null)
  }

  function handleRetry() {
    if (savedSelection)
      retry(savedSelection)
  }

  return (
    <>
      {bubbleEl && bubbleMode !== 'hidden' && createPortal(
        <RewriteBubbleMenu
          mode={bubbleMode}
          onAction={handleAction}
        />,
        bubbleEl,
      )}
      {measureEl && createPortal(
        <RewriteBubbleMenu
          mode="full"
          measuring
          onAction={handleAction}
          onFullWidthChange={handleFullWidthChange}
        />,
        measureEl,
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
