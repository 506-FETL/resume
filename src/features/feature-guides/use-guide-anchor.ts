import { useLayoutEffect, useState } from 'react'
import type { FeatureGuideId } from '@/store/feature-guides'

const surfaces = [
  '[data-slot="dialog-content"]',
  '[data-slot="alert-dialog-content"]',
  '[data-slot="drawer-popup"]',
  '[data-slot="dropdown-menu-content"]',
  '[data-slot="select-content"]',
  '[data-slot="combobox-content"]',
  '[data-slot="popover-content"]:not([data-feature-guide-ui])',
  'dialog[open]',
].join(',')

const unavailable =
  '[inert], [hidden], [aria-hidden="true"], [data-slot="drawer-popup"][data-ending-style]'

function isAvailable(node: HTMLElement) {
  return (
    node.isConnected &&
    !node.closest(unavailable) &&
    !node.matches(':disabled, [aria-disabled="true"]') &&
    (node.checkVisibility
      ? node.checkVisibility({
          opacityProperty: true,
          visibilityProperty: true,
        })
      : getComputedStyle(node).visibility === 'visible')
  )
}

// 画布开合改变页头宽度，编辑表单展开改变栏目列表高度，入口自身尺寸不变。
export function guidePositionContext(target: HTMLElement) {
  if (target.matches('[data-feature-guide-sort]'))
    return target.closest('[data-slot="accordion"]') ?? target

  return target.closest('[data-assistant-chat] > header') ?? target
}

export function findGuideTarget(selector: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
    (node) => {
      if (!isAvailable(node)) return false

      const rect = node.getBoundingClientRect()

      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < innerHeight &&
        rect.left < innerWidth
      )
    },
  )
}

export function useGuideAnchor(
  selector: string,
  enabled: boolean,
  id: FeatureGuideId,
  index: number,
) {
  const [state, setState] = useState<{
    selector: string
    target: HTMLElement | null
    pending: boolean
    blocked: boolean
  }>({ selector, target: null, blocked: false, pending: true })

  useLayoutEffect(() => {
    if (!enabled) return

    const minimumIntersection = id === 'sorting' ? 0.99 : 0.01
    const candidates = new Map<HTMLElement, boolean | null>()
    let layers: HTMLElement[] = []

    const publish = () => {
      const allowed = (node: HTMLElement) =>
        layers.every((layer) => layer.contains(node))

      const blocked =
        layers.length > 0 && !Array.from(candidates.keys()).some(allowed)

      const target =
        Array.from(candidates).find(
          ([node, intersects]) =>
            intersects && allowed(node) && isAvailable(node),
        )?.[0] ?? null

      const pending = !target && Array.from(candidates.values()).includes(null)

      setState((previous) =>
        previous.selector === selector &&
        previous.target === target &&
        previous.blocked === blocked &&
        previous.pending === pending
          ? previous
          : { selector, target, blocked, pending },
      )
    }

    // 浏览器同时计算视口和所有滚动祖先的裁切；离屏的手柄继续被观察。
    const intersection = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const node = entry.target as HTMLElement

          if (candidates.has(node))
            candidates.set(node, entry.intersectionRatio >= minimumIntersection)
        }

        publish()
      },
      { threshold: [0, minimumIntersection] },
    )

    // visibility 会保留布局尺寸，不一定触发 IntersectionObserver。
    const appearance = new MutationObserver(publish)

    const scan = () => {
      for (const node of candidates.keys()) {
        if (node.isConnected && node.matches(selector)) continue

        intersection.unobserve(node)
        candidates.delete(node)
      }

      for (const node of document.querySelectorAll<HTMLElement>(selector)) {
        if (candidates.has(node)) continue

        candidates.set(node, null)
        intersection.observe(node)
      }

      appearance.disconnect()

      const ancestors = new Set<Element>()

      for (const candidate of candidates.keys()) {
        let node: Element | null = candidate

        while (node && !ancestors.has(node)) {
          ancestors.add(node)

          appearance.observe(node, {
            attributes: true,
            attributeFilter: ['class', 'style'],
          })

          node = node.parentElement
        }
      }

      layers = Array.from(
        document.querySelectorAll<HTMLElement>(surfaces),
      ).filter((layer) => {
        if (layer.closest('[hidden]') || !layer.getClientRects().length)
          return false
        if (layer.matches('[data-feature-guide-demo="comment"]')) return false

        // 手机的划词和引用控件位于演示画布之外的 Portal。
        return !(
          id === 'assistant-quote' &&
          index > 0 &&
          layer.matches('[data-assistant-canvas]')
        )
      })

      publish()
    }

    const relevant = [selector, surfaces].join(',')

    const affectsTargets = (node: Node) =>
      node instanceof Element &&
      (node.matches(relevant) || Boolean(node.querySelector(relevant)))

    const observer = new MutationObserver((records) => {
      if (
        records.some((record) =>
          record.type === 'childList'
            ? [...record.addedNodes, ...record.removedNodes].some(
                affectsTargets,
              )
            : record.target instanceof Element &&
              (record.target.matches(relevant) ||
                Array.from(candidates.keys()).some((node) =>
                  record.target.contains(node),
                )),
        )
      )
        scan()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'inert',
        'hidden',
        'disabled',
        'aria-hidden',
        'aria-disabled',
        'data-ending-style',
        'data-feature-guide-selection',
        'open',
      ],
    })

    scan()

    return () => {
      observer.disconnect()
      appearance.disconnect()
      intersection.disconnect()
    }
  }, [enabled, id, index, selector])

  return {
    pending: state.selector !== selector || state.pending,
    target: enabled && state.selector === selector ? state.target : null,
    blocked: enabled && state.blocked,
  }
}
