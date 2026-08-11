import type { PaginationSnapshot, PaginationStatus } from './types'
import { useEffect, useRef, useState } from 'react'
import { MAX_STABILITY_FRAMES } from './const'
import {
  layoutSignaturesEqual,
  measurePaginationSnapshot,
  nextAnimationFrame,
  waitForResumeFont,
} from './utils'

interface UsePaginationPlanOptions {
  page: HTMLElement | null
  viewport: HTMLElement | null
  source: HTMLElement | null
  contentVersion: string
  familyName: string
  weights: number[]
}

export function usePaginationPlan({
  page,
  viewport,
  source,
  contentVersion,
  familyName,
  weights,
}: UsePaginationPlanOptions) {
  const [status, setStatus] = useState<PaginationStatus>('measuring')
  const [snapshot, setSnapshot] = useState<PaginationSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const generationRef = useRef(0)

  useEffect(() => {
    if (!page || !viewport || !source)
      return

    const generation = ++generationRef.current
    let disposed = false
    let scheduledFrame = 0
    let measurementId = 0

    const isCurrent = (requestId: number) =>
      !disposed
      && generationRef.current === generation
      && measurementId === requestId

    const measure = async (requestId: number) => {
      setStatus('measuring')
      setError(null)

      try {
        await waitForResumeFont(document, familyName, weights)
        let previous: PaginationSnapshot | null = null

        for (let frame = 0; frame < MAX_STABILITY_FRAMES; frame += 1) {
          await nextAnimationFrame()
          if (!isCurrent(requestId))
            return

          const current = measurePaginationSnapshot({
            page,
            viewport,
            source,
            fontFamily: source.ownerDocument.defaultView
              ?.getComputedStyle(source)
              .fontFamily ?? familyName,
          })

          if (
            previous
            && layoutSignaturesEqual(previous.signature, current.signature)
          ) {
            setSnapshot(current)
            setStatus('ready')
            return
          }
          previous = current
        }

        throw new Error('简历布局在限定时间内未稳定')
      }
      catch (caught) {
        if (!isCurrent(requestId))
          return
        setStatus('error')
        setError(caught instanceof Error ? caught.message : '简历分页失败')
      }
    }

    const schedule = () => {
      const requestId = ++measurementId
      cancelAnimationFrame(scheduledFrame)
      scheduledFrame = requestAnimationFrame(() => {
        measure(requestId).catch(() => undefined)
      })
    }

    const resizeObserver = new ResizeObserver(schedule)
    resizeObserver.observe(source)
    resizeObserver.observe(viewport)
    schedule()

    return () => {
      disposed = true
      measurementId += 1
      generationRef.current += 1
      cancelAnimationFrame(scheduledFrame)
      resizeObserver.disconnect()
    }
  }, [
    contentVersion,
    familyName,
    page,
    source,
    viewport,
    weights,
  ])

  return { status, snapshot, error }
}
