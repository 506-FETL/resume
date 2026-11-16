import type { InterviewSubStagesProps } from './types'
import type { InterviewSubStage } from '../../../types'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'

export function useInterviewRounds({
  subStages,
  onAddSubStage,
  onFlush,
}: Pick<InterviewSubStagesProps, 'subStages' | 'onAddSubStage' | 'onFlush'>) {
  const reduce = useReducedMotion()
  const isNarrow = useIsMobile(640)
  const cardWidth = isNarrow ? 9 : 10
  const connectorWidth = isNarrow ? 1.25 : 1.5
  const [selectedId, setSelectedId] = useState(subStages.at(-1)?.id ?? '')

  const [deletedRound, setDeletedRound] = useState<InterviewSubStage | null>(
    null,
  )

  const [deleteOpen, setDeleteOpen] = useState(false)

  const selectedRound =
    subStages.find((round) => round.id === selectedId) ?? subStages.at(-1)

  const activeRoundId = selectedRound?.id

  const selectedIndex = subStages.findIndex(
    (round) => round.id === selectedRound?.id,
  )

  const selectedLabel = selectedRound?.label || `第 ${selectedIndex + 1} 轮面试`
  const focusNewRound = useRef<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>())
  const scrollRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const deletedRef = useRef(false)
  const exitingRoundIdRef = useRef<string | null>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null)

  const revealSelectedRound = useCallback(() => {
    const viewport = scrollRef.current
    const trigger = activeRoundId && triggerRefs.current.get(activeRoundId)

    if (!viewport || !trigger || exitingRoundIdRef.current) return

    const viewportBox = viewport.getBoundingClientRect()
    const triggerBox = trigger.getBoundingClientRect()

    if (
      triggerBox.left < viewportBox.left ||
      triggerBox.right > viewportBox.right
    ) {
      viewport.scrollTo({
        left:
          viewport.scrollLeft +
          triggerBox.left -
          viewportBox.left -
          (viewport.clientWidth - triggerBox.width) / 2,
        behavior: reduce ? 'instant' : 'smooth',
      })
    }
  }, [activeRoundId, reduce])

  useEffect(() => {
    if (subStages.some((round) => round.id === exitingRoundIdRef.current))
      exitingRoundIdRef.current = null
  }, [subStages])

  useEffect(() => {
    const viewport = scrollRef.current
    let viewportWidth = viewport?.clientWidth

    revealSelectedRound()

    const observer = new ResizeObserver(() => {
      if (viewport?.clientWidth === viewportWidth) return

      viewportWidth = viewport?.clientWidth
      revealSelectedRound()
    })

    if (viewport) observer.observe(viewport)

    const frame =
      focusNewRound.current === activeRoundId
        ? requestAnimationFrame(() => {
            if (inputRef.current) {
              inputRef.current.focus({ preventScroll: true })
              inputRef.current.select()
              focusNewRound.current = null
            }
          })
        : null

    return () => {
      observer.disconnect()

      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [activeRoundId, subStages.length, revealSelectedRound])

  const handleSelect = (id: string) => {
    if (id === selectedRound?.id) return
    if (panelRef.current?.contains(document.activeElement))
      triggerRefs.current.get(id)?.focus({ preventScroll: true })

    onFlush()
    setSelectedId(id)
  }

  const handleAdd = () => {
    onFlush()

    const id = onAddSubStage()

    if (id) {
      focusNewRound.current = id
      setSelectedId(id)
    }
  }

  return {
    reduce,
    cardWidth,
    connectorWidth,
    setSelectedId,
    deletedRound,
    setDeletedRound,
    deleteOpen,
    setDeleteOpen,
    selectedRound,
    selectedIndex,
    selectedLabel,
    inputRef,
    triggerRefs,
    scrollRef,
    panelRef,
    addRef,
    headingRef,
    deletedRef,
    exitingRoundIdRef,
    deleteTriggerRef,
    revealSelectedRound,
    handleSelect,
    handleAdd,
  }
}
