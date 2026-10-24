import { useCallback, useEffect, useState } from 'react'

export function useOverflowState<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null)
  const [overflowing, setOverflowing] = useState(false)

  const ref = useCallback((node: T | null) => {
    setElement(node)
  }, [])

  useEffect(() => {
    if (!element) {
      setOverflowing(false)

      return
    }

    let frameId = 0

    const measure = () => {
      cancelAnimationFrame(frameId)

      frameId = window.requestAnimationFrame(() => {
        setOverflowing(element.scrollHeight > element.clientHeight + 1)
      })
    }

    const resizeObserver = new ResizeObserver(() => {
      measure()
    })

    resizeObserver.observe(element)

    const firstChild = element.firstElementChild

    if (firstChild instanceof HTMLElement) {
      resizeObserver.observe(firstChild)
    }

    window.addEventListener('resize', measure)
    measure()

    return () => {
      cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [element])

  return {
    ref,
    overflowing,
  }
}
