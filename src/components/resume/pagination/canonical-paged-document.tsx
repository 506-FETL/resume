import type { PropsWithChildren, Ref } from 'react'
import type { ResumeDocumentStateChange } from './types'
import type { ResumeAppearanceConfig } from '@/lib/schema'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useResumeStyles } from '@/hooks/use-resume-styles'
import { A4_PAGE_HEIGHT, A4_PAGE_WIDTH } from './const'
import { usePaginationPlan } from './use-pagination-plan'
import { serializeLayoutSignature } from './utils'

interface CanonicalPagedDocumentProps {
  appearance?: Partial<ResumeAppearanceConfig> | null
  contentVersion: string
  documentRef?: Ref<HTMLDivElement>
  sourceRef?: Ref<HTMLDivElement>
  onStateChange?: ResumeDocumentStateChange
  commentOverlayRoot?: boolean
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') {
    ref(value)
    return
  }
  if (ref)
    ref.current = value
}

export default function CanonicalPagedDocument({
  children,
  appearance,
  contentVersion,
  documentRef,
  sourceRef,
  onStateChange,
  commentOverlayRoot = false,
}: PropsWithChildren<CanonicalPagedDocumentProps>) {
  const { appearance: resolvedAppearance, font } = useResumeStyles(appearance)
  const pageMargin = resolvedAppearance.spacing.pageMargin
  const fontWeights = useMemo(
    () => Array.from(new Set([
      font.normalWeight,
      font.mediumWeight,
      font.boldWeight,
    ])),
    [font.boldWeight, font.mediumWeight, font.normalWeight],
  )
  const [page, setPage] = useState<HTMLDivElement | null>(null)
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const [source, setSource] = useState<HTMLDivElement | null>(null)
  const { status, snapshot, error } = usePaginationPlan({
    page,
    viewport,
    source,
    contentVersion,
    familyName: font.familyName,
    weights: fontWeights,
  })

  const handleSourceRef = useCallback((element: HTMLDivElement | null) => {
    setSource(element)
    assignRef(sourceRef, element)
  }, [sourceRef])

  const handleDocumentRef = useCallback((element: HTMLDivElement | null) => {
    assignRef(documentRef, element)
  }, [documentRef])

  useEffect(() => {
    onStateChange?.({
      status,
      signature: snapshot?.signature ?? null,
      fontFamily: font.familyName,
      fontWeights,
      error,
    })
  }, [
    error,
    font.familyName,
    fontWeights,
    onStateChange,
    snapshot?.signature,
    status,
  ])

  const segments = snapshot?.segments ?? [{
    start: 0,
    end: viewport?.getBoundingClientRect().height ?? 1,
    startKey: 'start',
    endKey: 'measuring',
  }]

  const measurementSource = (
    <div
      aria-hidden="true"
      data-resume-measurement-source="true"
      className="pointer-events-none fixed top-0 opacity-0"
      style={{
        left: '-100000px',
        width: A4_PAGE_WIDTH,
      }}
    >
      <div
        ref={setPage}
        style={{
          position: 'relative',
          width: A4_PAGE_WIDTH,
          height: A4_PAGE_HEIGHT,
        }}
      >
        <div
          ref={setViewport}
          style={{
            position: 'absolute',
            top: `${pageMargin}px`,
            right: `${pageMargin}px`,
            bottom: 0,
            left: `${pageMargin}px`,
          }}
        >
          <div
            ref={handleSourceRef}
            data-resume-source="true"
            style={{
              fontFamily: font.fontFamily,
              fontSynthesis: 'none',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {createPortal(measurementSource, document.body)}

      <div
        ref={handleDocumentRef}
        data-resume-document
        data-pagination-status={status}
        data-layout-signature={
          snapshot ? serializeLayoutSignature(snapshot.signature) : undefined
        }
        className="flex flex-col gap-4"
      >
        {segments.map((segment, index) => (
          <div
            key={`${segment.startKey}-${segment.endKey}`}
            data-resume-page
            data-resume-page-index={index}
            data-comment-page-visibility="visible"
            className="mx-auto overflow-hidden rounded-md border bg-white shadow-md"
            style={{
              width: A4_PAGE_WIDTH,
              height: A4_PAGE_HEIGHT,
              position: 'relative',
            }}
          >
            <div
              data-resume-page-viewport
              style={{
                position: 'absolute',
                top: `${pageMargin}px`,
                right: `${pageMargin}px`,
                bottom: 0,
                left: `${pageMargin}px`,
                overflow: 'hidden',
              }}
            >
              <div
                data-resume-page-clip
                data-page-index={index}
                data-start-key={segment.startKey}
                data-end-key={segment.endKey}
                style={{
                  height: `${Math.max(1, segment.end - segment.start)}px`,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  data-resume-page-content
                  style={{
                    position: 'absolute',
                    top: `${-segment.start}px`,
                    left: 0,
                    right: 0,
                    fontFamily: font.fontFamily,
                    fontSynthesis: 'none',
                  }}
                >
                  {children}
                </div>
              </div>
            </div>
            {commentOverlayRoot
              ? (
                  <div
                    aria-hidden="true"
                    data-comment-overlay-root
                    className="pointer-events-none absolute inset-0"
                  />
                )
              : null}
          </div>
        ))}
      </div>
    </>
  )
}
