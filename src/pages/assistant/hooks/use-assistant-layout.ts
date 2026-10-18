import { useLayoutEffect, useRef } from 'react'
import { CANVAS_MIN_WIDTH, CHAT_MIN_WIDTH } from '../const'
import useAssistantStore from '../store'

export function useAssistantLayout() {
  const rootRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = rootRef.current
    if (!element)
      return
    const update = () => {
      const width = element.getBoundingClientRect().width
      const mode = width >= CHAT_MIN_WIDTH + CANVAS_MIN_WIDTH ? 'split' : 'drawer'
      const previousMode = useAssistantStore.getState().layoutMode
      if (mode !== previousMode && document.activeElement?.closest('[data-assistant-canvas]'))
        document.getElementById('assistant-canvas-trigger')?.focus()
      useAssistantStore.getState().setAssistantLayout(mode, width)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return rootRef
}
