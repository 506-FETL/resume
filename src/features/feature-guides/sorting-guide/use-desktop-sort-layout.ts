import { useLayoutEffect, useState, type RefObject } from 'react'

export function useDesktopSortLayout(
  panelRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
) {
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    const panel = panelRef.current

    const content = panel?.querySelector<HTMLElement>(
      '[data-editor-panel-content]',
    )

    const accordion = content?.querySelector<HTMLElement>(
      '[data-slot="accordion"]',
    )

    if (!enabled || !panel || !content || !accordion) {
      setReady(false)

      return
    }

    const bodySelector =
      '[data-editor-section] > [data-slot="accordion-item"] > [data-slot="accordion-content"]'

    const update = () => {
      const section = accordion.querySelector(
        '[data-editor-section] > [data-slot="accordion-item"][data-state="open"]',
      )

      const resizing = Array.from(
        accordion.querySelectorAll(bodySelector + ':not([hidden])'),
      ).some((body) =>
        body
          .getAnimations()
          .some((animation) => animation.playState === 'running'),
      )

      // 分包占位也有高度，只有实际表单挂载后，后续栏目才在真实位置。
      setReady(
        panel.offsetWidth === content.offsetWidth &&
          !resizing &&
          (!section || !!section.querySelector('form')),
      )
    }

    const size = new ResizeObserver(update)

    size.observe(panel)
    size.observe(content)

    const form = new MutationObserver((records) => {
      if (
        records.some((record) =>
          record.type === 'attributes'
            ? (record.target as Element).matches('[data-slot="accordion-item"]')
            : [...record.addedNodes, ...record.removedNodes].some(
                (node) =>
                  node instanceof Element &&
                  (node.matches('form') || node.querySelector('form')),
              ),
        )
      )
        update()
    })

    const onAnimation = (event: AnimationEvent) => {
      if ((event.target as Element).matches(bodySelector)) update()
    }

    accordion.addEventListener('animationstart', onAnimation)
    accordion.addEventListener('animationend', onAnimation)
    accordion.addEventListener('animationcancel', onAnimation)

    form.observe(accordion, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state'],
    })

    update()

    return () => {
      size.disconnect()
      form.disconnect()
      accordion.removeEventListener('animationstart', onAnimation)
      accordion.removeEventListener('animationend', onAnimation)
      accordion.removeEventListener('animationcancel', onAnimation)
    }
  }, [enabled, panelRef])

  return ready
}
