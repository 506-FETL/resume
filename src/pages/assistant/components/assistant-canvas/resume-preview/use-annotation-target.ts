import type { RefObject } from 'react'
import type { CommentAnchorDocumentResult } from '@/features/resume-comments/anchors/types'
import type { ResumeDocumentState } from '@/components/resume/pagination/types'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { commentAnchorToRange } from '@/features/resume-comments/hooks/use-highlight-geometry'
import { rangeToVisiblePageRects } from '@/features/resume-comments/anchors/geometry'
import {
  COMMENT_MEASUREMENT_SOURCE_SELECTOR,
  COMMENT_HIDDEN_PAGE_SELECTOR,
} from '@/features/resume-comments/const'
import { DURATION, EASE } from '@/lib/motion'
import useAssistantStore from '../../../store'

export function useAnnotationTarget(
  rootRef: RefObject<HTMLDivElement | null>,
  model: CommentAnchorDocumentResult | null,
  resumeId: string | null,
  documentState: ResumeDocumentState | null,
) {
  const target = useAssistantStore((state) => state.annotationTarget)
  const reduced = useReducedMotion()

  useEffect(() => {
    const root = rootRef.current

    if (
      !target ||
      target.resumeId !== resumeId ||
      !model ||
      !root ||
      documentState?.status !== 'ready'
    )
      return

    const nodes = [
      ...root.querySelectorAll<HTMLElement>('[data-comment-node-key]'),
    ].filter(
      (node) =>
        !node.closest(COMMENT_MEASUREMENT_SOURCE_SELECTOR) &&
        !node.closest(COMMENT_HIDDEN_PAGE_SELECTOR),
    )

    let element: HTMLElement | undefined
    let range: Range | undefined

    for (const anchor of target.anchors) {
      for (const node of nodes.filter(
        (node) => node.dataset.commentNodeKey === anchor.nodeKey,
      )) {
        const resolved = commentAnchorToRange(node, anchor)

        if (!resolved || !rangeToVisiblePageRects(resolved.range).length)
          continue

        element = node
        range = resolved.range
        break
      }

      if (element) break
    }

    if (!element && !target.anchors.length)
      element = nodes.find((node) =>
        target.fields?.some(
          (field) => field.nodeKey === node.dataset.commentNodeKey,
        ),
      )

    if (!element) {
      useAssistantStore.setState({ annotationTarget: null })

      toast.info(
        target.anchors.length
          ? '这段文字已改变或删除，请在画布中重新选择。'
          : '已打开对应简历。这个字段尚未展示，可从“引用字段”查看。',
      )

      return
    }

    const scroller = root.querySelector<HTMLElement>('[data-canvas-scroll]')
    const visibleRect = range ? rangeToVisiblePageRects(range)[0] : undefined
    const page = element.closest<HTMLElement>('[data-resume-page-index]')

    if (scroller && page && visibleRect) {
      const pageRect = page.getBoundingClientRect()
      const scale = pageRect.width / page.offsetWidth

      scroller.scrollBy({
        top:
          pageRect.top +
          visibleRect.y * scale -
          scroller.getBoundingClientRect().top -
          scroller.clientHeight / 2,
        behavior: reduced ? 'instant' : 'smooth',
      })
    } else
      element.scrollIntoView({
        block: 'center',
        behavior: reduced ? 'instant' : 'smooth',
      })

    if (range) {
      const selection = window.getSelection()

      selection?.removeAllRanges()
      selection?.addRange(range)
    }

    const animation = element.animate(
      [
        { backgroundColor: 'var(--accent)' },
        { backgroundColor: 'transparent' },
      ],
      {
        duration: reduced ? 0 : DURATION.slow * 1000,
        easing: `cubic-bezier(${EASE.out.join(',')})`,
      },
    )

    animation.finished
      .then(() => {
        if (useAssistantStore.getState().annotationTarget === target)
          useAssistantStore.setState({ annotationTarget: null })
      })
      .catch(() => undefined)

    return () => animation.cancel()
  }, [target, resumeId, model, rootRef, documentState, reduced])
}
