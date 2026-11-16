import type { DragAxis } from '@/lib/motion-drag'
import type { RefObject, RefCallback } from 'react'
import { useRef, useMemo, useCallback, useEffect } from 'react'
import { useCrossListDragContext } from '../context'

export function useCrossListContainer({
  id,
  label = id,
  itemIds,
  axis = 'y',
  scrollRef,
}: {
  id: string
  label?: string
  itemIds: string[]
  axis?: DragAxis
  scrollRef?: RefObject<HTMLElement | null>
}): {
  ref: RefCallback<HTMLElement>
  active: boolean
  destinationIndex: number | null
  activeSourceId: string | null
  activeSourceIndex: number | null
} {
  const context = useCrossListDragContext()
  const { active, registerContainer, destination } = context
  const unregisterRef = useRef<(() => void) | null>(null)
  const elementRef = useRef<HTMLElement | null>(null)
  const itemIdsKey = itemIds.join('\u0000')

  const registeredItemIds = useMemo(
    () => (itemIdsKey === '' ? [] : itemIdsKey.split('\u0000')),
    [itemIdsKey],
  )

  const registrationRef = useRef({
    label,
    itemIds: registeredItemIds,
    axis,
    scrollRef,
  })

  registrationRef.current = {
    label,
    itemIds: registeredItemIds,
    axis,
    scrollRef,
  }

  const ref = useCallback<RefCallback<HTMLElement>>(
    (element) => {
      elementRef.current = element

      if (!element) {
        unregisterRef.current?.()
        unregisterRef.current = null

        return
      }

      const registration = registrationRef.current

      unregisterRef.current = registerContainer({
        id,
        label: registration.label,
        element,
        itemIds: registration.itemIds,
        axis: registration.axis,
        scrollElement: registration.scrollRef?.current ?? element,
      })
    },
    [id, registerContainer],
  )

  useEffect(() => {
    const element = elementRef.current

    if (element) {
      const registration = registrationRef.current

      unregisterRef.current = registerContainer({
        id,
        label: registration.label,
        element,
        itemIds: registration.itemIds,
        axis: registration.axis,
        scrollElement: registration.scrollRef?.current ?? element,
      })
    }
  }, [axis, id, label, registerContainer, registeredItemIds, scrollRef])

  useEffect(() => () => unregisterRef.current?.(), [])

  return {
    ref,
    active: destination?.containerId === id,
    destinationIndex:
      destination?.containerId === id ? destination.index : null,
    activeSourceId: active?.sourceId ?? null,
    activeSourceIndex: active?.sourceIndex ?? null,
  }
}
