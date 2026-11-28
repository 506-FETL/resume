import { useEffect, useRef, useState } from 'react'
import useAssistantStore from '@/pages/assistant/store'
import GuidePresentation from '../components/guide-presentation'
import SelectionDemo, { type GuideSelection } from '../selection'
import { pickGuideSelection } from '../selection/geometry'
import type { GuideStep } from '../types'
import { findGuideTarget } from '../use-guide-anchor'
import { useFeatureGuide } from '../use-feature-guide'
import ReferenceDemo from './reference-demo'

const steps: GuideStep[] = [
  {
    target: '#assistant-canvas-trigger',
    title: '选一段，让 AI 帮你改',
    hint: '引用对话',
    description: '画布里的文字可以直接引用到对话，不用来回复制。',
    side: 'bottom',
  },
  {
    target: '[data-feature-guide-canvas-header]',
    title: '在画布里找到原文',
    description: '在「简历预览」里，你可以对照原文和 AI 讨论。',
    animated: true,
    side: 'left',
  },
  {
    target: '[data-feature-guide-selection]',
    title: '划出要修改的内容',
    description: '选中一段正文，再点「引用到对话」。',
    nextLabel: '演示引用',
    animated: true,
    side: 'bottom',
  },
  {
    target: '[data-feature-guide-demo="reference"]',
    title: '带着原文提问',
    description: '引用会出现在输入区，再写下修改要求即可。演示不会发送消息。',
    animated: true,
    side: 'top',
  },
]

export default function AssistantGuide() {
  const enabled = useAssistantStore(
    (state) =>
      !state.initializing &&
      !state.loadingConversations &&
      !state.loadingMessages &&
      !state.streaming &&
      !state.bootstrapError,
  )

  const conversation = useAssistantStore((state) => state.activeConversationId)
  const layoutMode = useAssistantStore((state) => state.layoutMode)

  const originalCanvasRef = useRef<Pick<
    ReturnType<typeof useAssistantStore.getState>,
    'canvasOpen' | 'canvasMobileOpen' | 'canvasActiveTab'
  > | null>(null)

  const [selection, setSelection] = useState<GuideSelection | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  const guide = useFeatureGuide({
    id: 'assistant-quote',
    enabled,
    contextKey: `${conversation}:${layoutMode}`,
    steps: unavailable
      ? steps.map((step, index) =>
          index === 1
            ? {
                ...step,
                description: '先打开一份有正文的简历，就能试试划词引用。',
                nextLabel: '知道了',
                terminal: true,
              }
            : step,
        )
      : steps,
    prepare: (index) => {
      const store = useAssistantStore.getState()

      if (index === 0 && originalCanvasRef.current)
        useAssistantStore.setState(originalCanvasRef.current)

      if (index === 1) {
        originalCanvasRef.current ??= {
          canvasOpen: store.canvasOpen,
          canvasMobileOpen: store.canvasMobileOpen,
          canvasActiveTab: store.canvasActiveTab,
        }

        setUnavailable(false)
      }

      if (index === 1 || index === 2) {
        store.setCanvasActiveTab('resume')

        if (store.layoutMode === 'drawer') store.setCanvasMobileOpen(true)
        else store.setCanvasOpen(true)
      }

      if (index === 2) setSelection(null)

      if (index === 3 && store.layoutMode === 'drawer')
        store.setCanvasMobileOpen(false)
    },
    onStop: (reason) => {
      if (!originalCanvasRef.current) return

      if (reason === 'dismiss')
        useAssistantStore.setState(originalCanvasRef.current)

      originalCanvasRef.current = null
    },
  })

  const { active, index, ready, previous } = guide

  useEffect(() => {
    if (!active || (index !== 1 && index !== 2)) return

    let frame = 0
    let finished = false
    let inspectedRoot: HTMLElement | null = null
    let inspectedStatus: string | undefined
    let previousBounds = ''

    const inspect = () => {
      if (finished) return

      const root = findGuideTarget('[data-feature-guide-preview-status]')

      const status = root?.dataset.featureGuidePreviewStatus

      if (!root) return
      if (index === 1 && root === inspectedRoot && status === inspectedStatus)
        return
      if (status !== 'ready' && status !== 'empty' && status !== 'error') return

      const canvas = root.closest<HTMLElement>('[data-assistant-canvas]')

      const bounds = JSON.stringify([
        canvas?.getBoundingClientRect().toJSON(),
        root.getBoundingClientRect().toJSON(),
      ])

      const opening = canvas
        ?.getAnimations({ subtree: true })
        .some(
          (animation) =>
            animation.playState === 'running' &&
            animation.effect?.getComputedTiming().iterations !== Infinity,
        )

      if (opening || bounds !== previousBounds) {
        previousBounds = bounds
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(inspect)

        return
      }

      const next = status === 'ready' ? pickGuideSelection(root) : null

      // 空态、分页与已排版正文可能先后挂载；后到的正文仍可继续演示。
      finished = index === 2
      inspectedRoot = next || status !== 'ready' ? root : null
      inspectedStatus = status
      setUnavailable(!next)

      if (index === 1) ready()
      else if (next) setSelection(next)
      else {
        ready()
        previous()
      }
    }

    const observer = new MutationObserver(inspect)

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: [
        'data-feature-guide-preview-status',
        'data-feature-guide-canvas-resume',
        'aria-hidden',
        'inert',
      ],
      childList: true,
      subtree: true,
    })

    inspect()

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [active, index, previous, ready])

  return (
    <>
      {selection && (
        <SelectionDemo
          blocked={guide.blocked}
          selection={selection}
          phase='select'
          visible={guide.active && guide.index === 2}
          playing={guide.presentedIndex === 2}
          actionLabel='引用到对话'
          onAction={guide.next}
          onReady={guide.ready}
          onUnavailable={guide.interrupt}
        />
      )}
      <ReferenceDemo
        blocked={guide.blocked}
        visible={guide.active && guide.index === 3}
        quote={selection?.text ?? ''}
        onReady={guide.ready}
      />
      <GuidePresentation guide={guide} />
    </>
  )
}
