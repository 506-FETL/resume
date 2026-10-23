import type { PropsWithChildren, Ref } from 'react'
import type { ResumeDocumentStateChange } from './types'
import type { TemplateDefinition } from '@/lib/resume-template/definition-schema'
import type { ResumeAppearanceConfig } from '@/lib/schema'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { TemplatePageBackground } from '@/components/resume/runtime/template-page-background'
import { TemplateRegionContext } from '@/components/resume/runtime/template-region-context'
import { useResumeStyles } from '@/hooks/use-resume-styles'
import { resolveTemplatePage } from '@/lib/resume-template/declarative/page'
import { A4_PAGE_HEIGHT, A4_PAGE_WIDTH } from './const'
import { usePaginationPlan } from './use-pagination-plan'
import { serializeLayoutSignature } from './utils'

interface CanonicalPagedDocumentProps {
  definition: TemplateDefinition
  appearance?: Partial<ResumeAppearanceConfig> | null
  contentVersion: string
  documentRef?: Ref<HTMLDivElement>
  sourceRef?: Ref<HTMLDivElement>
  onStateChange?: ResumeDocumentStateChange
  commentOverlayRoot?: boolean
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function')
    ref(value)
  else if (ref)
    ref.current = value
}

/** 测量源与每张纸使用同一页面计划，各区域独立消费自己的正文切片。 */
export default function CanonicalPagedDocument({
  children,
  definition,
  appearance,
  contentVersion,
  documentRef,
  sourceRef,
  onStateChange,
  commentOverlayRoot = false,
}: PropsWithChildren<CanonicalPagedDocumentProps>) {
  const { appearance: resolvedAppearance, font } = useResumeStyles(appearance)
  const plan = useMemo(() => resolveTemplatePage(definition, resolvedAppearance), [definition, resolvedAppearance])
  const fontWeights = useMemo(() => Array.from(new Set([font.normalWeight, font.mediumWeight, font.boldWeight])), [font.boldWeight, font.mediumWeight, font.normalWeight])
  const [page, setPage] = useState<HTMLDivElement | null>(null)
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const [source, setSource] = useState<HTMLDivElement | null>(null)
  const { status, snapshot, error } = usePaginationPlan({ page, viewport, source, contentVersion, familyName: font.familyName, weights: fontWeights })
  const handleSourceRef = useCallback((element: HTMLDivElement | null) => {
    setSource(element)
    assignRef(sourceRef, element)
  }, [sourceRef])
  const handleDocumentRef = useCallback((element: HTMLDivElement | null) => assignRef(documentRef, element), [documentRef])

  useEffect(() => {
    onStateChange?.({ status, signature: snapshot?.signature ?? null, fontFamily: font.familyName, fontWeights, error })
  }, [error, font.familyName, fontWeights, onStateChange, snapshot?.signature, status])

  const fontStyle = { fontFamily: font.fontFamily, fontSynthesis: 'none' as const }
  const paperStyle = { position: 'relative' as const, width: A4_PAGE_WIDTH, height: A4_PAGE_HEIGHT }
  const pageCount = snapshot?.signature.pages.length ?? 1
  const renderRegions = (pageIndex: number | null) => plan.regions.map((region) => {
    const segment = pageIndex === null ? null : snapshot?.regions.find(item => item.id === region.id)?.segments[pageIndex]
    const empty = pageIndex !== null && snapshot && !segment
    return (
      <div
        key={region.id}
        data-resume-region-viewport={region.id}
        style={{ position: 'absolute', left: region.left, top: region.top, width: region.width, height: region.height, overflow: pageIndex === null ? 'visible' : 'hidden' }}
      >
        <div
          data-resume-page-clip={pageIndex !== null ? region.id : undefined}
          data-page-index={pageIndex ?? undefined}
          data-start-key={segment?.startKey ?? 'start'}
          data-end-key={segment?.endKey ?? (empty ? 'empty' : 'measuring')}
          data-region-start={segment?.start ?? 0}
          data-region-end={segment?.end ?? 0}
          style={{ position: 'relative', height: pageIndex === null ? undefined : empty ? 0 : segment ? Math.max(0, segment.end - segment.start) : region.height, overflow: pageIndex === null ? 'visible' : 'hidden' }}
        >
          <div
            data-resume-region-source={region.id}
            style={{ position: pageIndex === null ? 'relative' : 'absolute', top: pageIndex === null ? undefined : -(segment?.start ?? 0), left: 0, right: 0, ...fontStyle }}
          >
            <TemplateRegionContext value={region.id}>{children}</TemplateRegionContext>
          </div>
        </div>
      </div>
    )
  })
  const measurementSource = (
    // WebKit 在极远的离屏坐标会损失文字矩形精度；原点裁切保持测量与打印的几何一致。
    <div aria-hidden="true" data-resume-measurement-source="true" className="pointer-events-none fixed top-0 left-0 h-0 overflow-hidden opacity-0" style={{ width: A4_PAGE_WIDTH }}>
      <div ref={setPage} style={paperStyle}>
        <div ref={setViewport} style={{ position: 'absolute', inset: 0 }}>
          <div ref={handleSourceRef} data-resume-source="true" style={{ position: 'absolute', inset: 0, ...fontStyle }}>{renderRegions(null)}</div>
        </div>
      </div>
    </div>
  )
  return (
    <>
      {createPortal(measurementSource, document.body)}
      <div ref={handleDocumentRef} data-resume-document data-pagination-status={status} data-layout-signature={snapshot ? serializeLayoutSignature(snapshot.signature) : undefined} className="flex flex-col gap-4">
        {Array.from({ length: pageCount }, (_, index) => (
          <div key={index} data-resume-page data-resume-page-index={index} data-comment-page-visibility="visible" className="mx-auto overflow-hidden rounded-md bg-white shadow-md ring-1 ring-inset ring-border" style={paperStyle}>
            <TemplatePageBackground definition={definition} appearance={resolvedAppearance} pageIndex={index} />
            <div data-resume-page-viewport style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
              <div data-resume-page-content style={{ position: 'absolute', inset: 0, ...fontStyle }}>{renderRegions(index)}</div>
            </div>
            {commentOverlayRoot && <div aria-hidden="true" data-comment-overlay-root data-resume-comment-ui className="pointer-events-none absolute inset-0" />}
          </div>
        ))}
      </div>
    </>
  )
}
