import type { ExampleRef, TemplateCatalogItem } from '@/lib/resume-template/source/types'
import { useMemo } from 'react'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'
import TemplateResourceStatus from '@/components/resume/template-resource-status'
import { useResolvedResumeTemplate } from '@/hooks/use-resolved-resume-template'
import { toTemplateBinding } from '@/lib/resume-template/compatibility/binding'
import { useTemplateExample } from '../../hooks/use-template-example'
import { catalogTemplateRef } from '../../utils.ts'

export default function ExamplePreview({ item, example }: { item: TemplateCatalogItem, example: ExampleRef }) {
  const { resource, retry } = useTemplateExample(example)
  const template = useResolvedResumeTemplate({ binding: toTemplateBinding(catalogTemplateRef(item)) })
  const data = useMemo(() => resource?.status === 'ready' ? buildTemplateResumeData({ ...resource.data.content, type: 'default' }) : null, [resource])
  if (resource?.status !== 'ready' || !data)
    return <TemplateResourceStatus error={resource?.status === 'error' ? resource.error.message : undefined} onRetry={retry} />
  if (template.resource.status !== 'ready')
    return <TemplateResourceStatus error={template.resource.status === 'error' ? template.resource.error.message : undefined} onRetry={template.retry} />
  return <ScaledReadonlyPreview data={data} definition={template.resource.data} appearance={template.resource.data.appearanceDefaults} projectionReferenceDate={resource.data.projectionReferenceDate} />
}
