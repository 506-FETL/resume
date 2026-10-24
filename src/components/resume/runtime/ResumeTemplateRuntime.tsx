import type { TemplateResumeData } from './context/resume-data-context'
import type { TemplateDefinition } from '@/lib/resume-template/definition-schema'
import type { ResumeAppearanceConfig } from '@/lib/schema'
import { useMemo } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import TemplateResourceStatus from '@/components/resume/template-resource-status'
import { adaptResumeContent } from '@/lib/resume-template/content/adapt-resume'
import { createTemplateStyleEnvironment } from '@/lib/resume-template/declarative/styles'
import {
  asTemplateError,
  parseTemplateDefinition,
} from '@/lib/resume-template/definition-schema'
import { normalizeResumeAppearance } from '@/lib/schema'
import { useResumeContext } from './context/resume-context'
import { DeclarativeRenderer } from './declarative-renderer'
import { TemplateRuntimeProviders } from './TemplateRuntimeProviders'

function ResumeContent({
  data,
  definition,
  appearance,
  assetUrls,
}: {
  data: TemplateResumeData
  definition: TemplateDefinition
  appearance: ResumeAppearanceConfig
  assetUrls?: ReadonlyMap<string, string>
}) {
  const { commentNodesByKey } = useResumeContext()
  const content = useMemo(
    () => adaptResumeContent(data, commentNodesByKey),
    [data, commentNodesByKey],
  )
  const environment = useMemo(
    () => createTemplateStyleEnvironment(definition, appearance),
    [definition, appearance],
  )
  return (
    <DeclarativeRenderer
      definition={definition}
      content={content}
      environment={environment}
      assetUrls={assetUrls}
    />
  )
}
function ValidatedTemplateRuntime({
  data,
  definition: definitionInput,
  appearance,
  projectionReferenceDate,
  assetUrls,
}: {
  data: TemplateResumeData
  definition: TemplateDefinition
  appearance: Partial<ResumeAppearanceConfig>
  projectionReferenceDate: string
  assetUrls?: ReadonlyMap<string, string>
}) {
  const definition = useMemo(
    () => parseTemplateDefinition(definitionInput),
    [definitionInput],
  )
  const effectiveAppearance = useMemo(
    () => normalizeResumeAppearance(appearance),
    [appearance],
  )
  return (
    <TemplateRuntimeProviders
      data={data}
      appearance={effectiveAppearance}
      projectionReferenceDate={projectionReferenceDate}
      tokens={definition.tokens}
    >
      <ResumeContent
        data={data}
        definition={definition}
        appearance={effectiveAppearance}
        assetUrls={assetUrls}
      />
    </TemplateRuntimeProviders>
  )
}

export function ResumeTemplateRuntime(
  props: Parameters<typeof ValidatedTemplateRuntime>[0],
) {
  return (
    <ErrorBoundary
      resetKeys={[
        props.definition,
        props.data,
        props.appearance,
        props.assetUrls,
      ]}
      fallbackRender={({ error, resetErrorBoundary }) => (
        <div
          data-resume-runtime-ready='false'
          data-resume-runtime-error={asTemplateError(error).message}
        >
          <TemplateResourceStatus
            error={asTemplateError(error).message}
            onRetry={resetErrorBoundary}
          />
        </div>
      )}
    >
      <ValidatedTemplateRuntime {...props} />
    </ErrorBoundary>
  )
}
