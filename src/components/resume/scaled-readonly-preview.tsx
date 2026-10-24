import type { Ref } from 'react'
import type { ResumeDocumentStateChange } from './pagination/types'
import type { TemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import type { TemplateDefinition } from '@/lib/resume-template/definition-schema'
import type { ResumeAppearanceConfig } from '@/lib/schema'
import { useLayoutEffect, useMemo } from 'react'
import { ResumeTemplateRuntime } from '@/components/resume/runtime/ResumeTemplateRuntime'
import { useResolvedResumeTemplate } from '@/hooks/use-resolved-resume-template'
import {
  DEFAULT_RESUME_FONT_FAMILY_NAME,
  normalizeResumeAppearance,
} from '@/lib/schema'
import ScaledResumeDocument from './pagination/scaled-resume-document'
import TemplateResourceStatus from './template-resource-status'

interface ScaledReadonlyPreviewProps {
  data: TemplateResumeData
  appearance: Partial<ResumeAppearanceConfig>
  definition?: TemplateDefinition | null
  assetUrls?: ReadonlyMap<string, string>
  className?: string
  documentRef?: Ref<HTMLDivElement>
  sourceRef?: Ref<HTMLDivElement>
  onDocumentStateChange?: ResumeDocumentStateChange
  projectionReferenceDate?: string
}

export default function ScaledReadonlyPreview({
  data,
  appearance,
  definition,
  assetUrls: suppliedAssetUrls,
  className,
  documentRef,
  sourceRef,
  onDocumentStateChange,
  projectionReferenceDate = new Date().toISOString().slice(0, 10),
}: ScaledReadonlyPreviewProps) {
  const { resource, retry, assetUrls } = useResolvedResumeTemplate({
    binding: data.templateBinding,
    definition,
    assetUrls: suppliedAssetUrls,
  })

  const effectiveAppearance = useMemo(
    () => normalizeResumeAppearance(appearance),
    [appearance],
  )

  const error = resource.status === 'error' ? resource.error.message : null

  useLayoutEffect(() => {
    if (resource.status !== 'ready') {
      onDocumentStateChange?.({
        status: error ? 'error' : 'measuring',
        error,
        signature: null,
        fontFamily: DEFAULT_RESUME_FONT_FAMILY_NAME,
        fontWeights: [400, 600, 700],
      })
    }
  }, [resource.status, error, onDocumentStateChange])

  if (resource.status !== 'ready')
    return <TemplateResourceStatus error={error ?? undefined} onRetry={retry} />

  return (
    <ScaledResumeDocument
      definition={resource.data}
      appearance={effectiveAppearance}
      contentVersion={JSON.stringify([
        data,
        resource.data,
        effectiveAppearance,
        projectionReferenceDate,
      ])}
      documentRef={documentRef}
      sourceRef={sourceRef}
      onStateChange={onDocumentStateChange}
      className={className}
    >
      <ResumeTemplateRuntime
        data={data}
        definition={resource.data}
        appearance={effectiveAppearance}
        projectionReferenceDate={projectionReferenceDate}
        assetUrls={assetUrls}
      />
    </ScaledResumeDocument>
  )
}
