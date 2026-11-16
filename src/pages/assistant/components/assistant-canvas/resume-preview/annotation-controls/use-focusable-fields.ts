import type { AnnotationSelectionOptions } from './types'
import type { buildAnnotationFields } from './fields'
import { useEffect } from 'react'
import { hasVisibleCanvasText, resolveCanvasSelection } from '../selection'
import {
  COMMENT_HIDDEN_PAGE_SELECTOR,
  COMMENT_MEASUREMENT_SOURCE_SELECTOR,
} from '@/features/resume-comments/const'

export function useFocusableFields({
  rootRef,
  model,
  resumeId,
  pointerSelectingRef,
  keyboardFieldRef,
  setSelected,
  fields,
}: AnnotationSelectionOptions & {
  fields: ReturnType<typeof buildAnnotationFields>
}) {
  useEffect(() => {
    const root = rootRef.current

    if (!root) return

    const original = new Map<
      HTMLElement,
      {
        tabIndex: string | null
        label: string | null
        shortcuts: string | null
      }
    >()

    const clippingStyles = new Map<HTMLElement, string>()

    const labels = new Map(fields.map((field) => [field.nodeKey, field.label]))

    const restore = (node: HTMLElement) => {
      const previous = original.get(node)

      if (!previous) return

      for (const [attribute, value] of [
        ['tabindex', previous.tabIndex],
        ['aria-label', previous.label],
        ['aria-keyshortcuts', previous.shortcuts],
      ]) {
        if (value === null) node.removeAttribute(attribute!)
        else node.setAttribute(attribute!, value!)
      }

      node.removeAttribute('data-annotation-focusable')
      original.delete(node)
    }

    const updateFields = () => {
      // hidden 会让键盘聚焦滚动分页内部；clip 只裁剪，纸张几何与打印源不变。
      for (const node of root.querySelectorAll<HTMLElement>(
        '[data-resume-page-index] [data-resume-page-viewport], [data-resume-page-index] [data-resume-region-viewport], [data-resume-page-index] [data-resume-page-clip]',
      )) {
        if (clippingStyles.has(node)) continue

        clippingStyles.set(node, node.style.overflow)
        node.style.overflow = 'clip'
      }

      for (const node of root.querySelectorAll<HTMLElement>(
        '[data-comment-node-key]',
      )) {
        if (
          node.closest(COMMENT_HIDDEN_PAGE_SELECTOR) ||
          node.closest(COMMENT_MEASUREMENT_SOURCE_SELECTOR) ||
          !hasVisibleCanvasText(node)
        ) {
          restore(node)
          continue
        }
        if (original.has(node)) continue

        original.set(node, {
          tabIndex: node.getAttribute('tabindex'),
          label: node.getAttribute('aria-label'),
          shortcuts: node.getAttribute('aria-keyshortcuts'),
        })

        node.tabIndex = 0
        node.setAttribute('data-annotation-focusable', '')
        node.setAttribute('aria-keyshortcuts', 'Enter')

        node.setAttribute(
          'aria-label',
          `${labels.get(node.dataset.commentNodeKey ?? '') ?? '简历字段'}，按 Enter 引用到对话`,
        )
      }
    }

    const focusField = (event: FocusEvent) => {
      const node = event.target

      if (
        !(node instanceof HTMLElement) ||
        !node.hasAttribute('data-annotation-focusable') ||
        pointerSelectingRef.current
      )
        return

      keyboardFieldRef.current = node

      const range = document.createRange()

      range.selectNodeContents(node)

      const value = resolveCanvasSelection(root, range, model)

      setSelected(
        value ? { value, documentHash: model.documentHash, resumeId } : null,
      )
    }

    const quoteField = (event: KeyboardEvent) => {
      if (
        event.key !== 'Enter' ||
        event.isComposing ||
        !(event.target instanceof HTMLElement) ||
        !event.target.hasAttribute('data-annotation-focusable')
      )
        return

      event.preventDefault()

      document
        .querySelector<HTMLButtonElement>('[data-annotation-bubble] button')
        ?.click()
    }

    const leaveField = (event: FocusEvent) => {
      const next = event.relatedTarget

      if (
        next instanceof Element &&
        (root.contains(next) || next.closest('[data-annotation-bubble]'))
      )
        return

      setSelected(null)
      keyboardFieldRef.current = null
    }

    // 仅装饰助手的可见分页副本；测量、打印与其他页面不获得交互属性。
    updateFields()

    const observer = new MutationObserver(updateFields)
    const sizeObserver = new ResizeObserver(updateFields)

    sizeObserver.observe(root)

    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-comment-page-visibility'],
    })

    root.addEventListener('focusin', focusField)
    root.addEventListener('focusout', leaveField)
    root.addEventListener('keydown', quoteField)

    return () => {
      observer.disconnect()
      sizeObserver.disconnect()
      root.removeEventListener('focusin', focusField)
      root.removeEventListener('focusout', leaveField)
      root.removeEventListener('keydown', quoteField)

      for (const node of original.keys()) restore(node)

      for (const [node, overflow] of clippingStyles)
        node.style.overflow = overflow
    }
  }, [
    rootRef,
    fields,
    model,
    resumeId,
    pointerSelectingRef,
    keyboardFieldRef,
    setSelected,
  ])
}
