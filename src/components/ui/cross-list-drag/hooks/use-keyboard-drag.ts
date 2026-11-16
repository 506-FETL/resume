import type {
  RefObject,
  Dispatch,
  SetStateAction,
  KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { useCallback, useEffect } from 'react'
import type { ContainerRegistration, DragSession, ActiveDrag } from '../types'
import type { DropDestination } from '@/lib/motion-drag'
import { isInteractiveTarget } from '../geometry'

export function useKeyboardDrag({
  containersRef,
  sessionRef,
  active,
  setActive,
  setDestination,
  setLiveMessage,
  clearPreview,
  clearSession,
  finishSession,
}: {
  containersRef: RefObject<Map<string, ContainerRegistration>>
  sessionRef: RefObject<DragSession | null>
  active: ActiveDrag | null
  setActive: Dispatch<SetStateAction<ActiveDrag | null>>
  setDestination: Dispatch<SetStateAction<DropDestination | null>>
  setLiveMessage: Dispatch<SetStateAction<string>>
  clearPreview: () => void
  clearSession: (
    updateState?: boolean,
    pendingDrop?: void | Promise<void>,
  ) => void
  finishSession: () => void
}) {
  const describeDestination = useCallback((next: DropDestination): string => {
    const container = containersRef.current.get(next.containerId)

    if (!container) return ''

    return `已移动到${container.label}第 ${next.index + 1} 位`
  }, [])

  const handleKeyboardDrag = useCallback(
    (
      event: ReactKeyboardEvent<HTMLElement>,
      item: Pick<DragSession, 'itemId' | 'sourceId' | 'sourceIndex'>,
    ) => {
      if (isInteractiveTarget(event.target, event.currentTarget)) return

      const session = sessionRef.current

      if (!session) {
        if (event.key !== ' ' && event.key !== 'Enter') return

        const source = containersRef.current.get(item.sourceId)

        if (!source) return

        event.preventDefault()
        event.stopPropagation()
        clearPreview()

        const startRect = event.currentTarget.getBoundingClientRect()

        const initialDestination = {
          containerId: item.sourceId,
          index: item.sourceIndex,
        }

        sessionRef.current = {
          kind: 'keyboard',
          pointerId: -1,
          ...item,
          itemElement: event.currentTarget,
          startPoint: { x: startRect.left, y: startRect.top },
          startRect,
          active: true,
          touchTimer: null,
          destination: initialDestination,
        }

        setActive({ kind: 'keyboard', ...item, startRect })
        setDestination(initialDestination)

        setLiveMessage(
          `已拾取可拖动项目，当前位置为${source.label}第 ${item.sourceIndex + 1} 位`,
        )

        return
      }

      if (session.kind !== 'keyboard' || session.itemId !== item.itemId) return

      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        clearSession()
        setLiveMessage('已取消拖动')

        return
      }

      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()

        const finalDestination = session.destination

        finishSession()

        setLiveMessage(
          finalDestination
            ? `已放置，${describeDestination(finalDestination)}`
            : '已取消拖动',
        )

        return
      }

      if (
        !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)
      )
        return

      event.preventDefault()
      event.stopPropagation()

      const containers = [...containersRef.current.values()]

      const currentDestination = session.destination ?? {
        containerId: session.sourceId,
        index: session.sourceIndex,
      }

      let target = containersRef.current.get(currentDestination.containerId)

      if (!target) return

      let nextIndex = currentDestination.index

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const currentContainerIndex = containers.findIndex(
          (container) => container.id === target?.id,
        )

        const containerDelta = event.key === 'ArrowLeft' ? -1 : 1
        const nextContainer = containers[currentContainerIndex + containerDelta]

        if (!nextContainer) return

        target = nextContainer

        const targetLength = target.itemIds.filter(
          (id) => id !== session.itemId,
        ).length

        nextIndex = Math.min(nextIndex, targetLength)
      } else {
        const itemCountWithoutActive = target.itemIds.filter(
          (id) => id !== session.itemId,
        ).length

        const itemDelta = event.key === 'ArrowUp' ? -1 : 1

        nextIndex = Math.max(
          0,
          Math.min(itemCountWithoutActive, nextIndex + itemDelta),
        )

        if (nextIndex === currentDestination.index) return
      }

      const nextDestination = { containerId: target.id, index: nextIndex }

      session.destination = nextDestination
      setDestination(nextDestination)
      setLiveMessage(describeDestination(nextDestination))
    },
    [clearPreview, clearSession, describeDestination, finishSession],
  )

  useEffect(() => {
    if (active?.kind !== 'keyboard') return

    const cancelKeyboardSession = () => {
      if (sessionRef.current?.kind !== 'keyboard') return

      clearSession()
      setLiveMessage('已取消拖动')
    }

    const handleFocusIn = (event: FocusEvent) => {
      const session = sessionRef.current

      if (session?.kind !== 'keyboard' || !(event.target instanceof Node))
        return
      if (!session.itemElement.contains(event.target)) cancelKeyboardSession()
    }

    document.addEventListener('focusin', handleFocusIn, true)

    return () => {
      document.removeEventListener('focusin', handleFocusIn, true)
    }
  }, [active, clearSession])

  return { handleKeyboardDrag }
}
