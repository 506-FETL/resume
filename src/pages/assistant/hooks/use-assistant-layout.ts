import { useLayoutEffect, useRef } from 'react'
import { CANVAS_MIN_WIDTH, CHAT_MIN_WIDTH } from '../const'
import useAssistantStore from '../store'

export function useAssistantLayout() {
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = rootRef.current

    if (!element) return

    const update = (width: number) => {
      const mode =
        width >= CHAT_MIN_WIDTH + CANVAS_MIN_WIDTH ? 'split' : 'drawer'

      const state = useAssistantStore.getState()

      if (state.layoutMode === mode && state.availableWidth === width) return

      if (
        mode !== state.layoutMode &&
        document.activeElement?.closest('[data-assistant-canvas]')
      )
        document.getElementById('assistant-canvas-trigger')?.focus()

      state.setAssistantLayout(mode, width)
    }

    update(element.getBoundingClientRect().width)

    const observer = new ResizeObserver(([entry]) => {
      update(entry.contentRect.width)
    })

    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return rootRef
}
