import type { TemplateResumeDataInput } from '@/components/resume/runtime/context/resume-data-context'
import type { TemplateDefinition } from '@/lib/resume-template/definition-schema'
import { createRoot } from 'react-dom/client'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { ResumeTemplateRuntime } from '@/components/resume/runtime/ResumeTemplateRuntime'

/** 仅浏览器验收入口，生产路由不引用。 */
export function mountEdgeInstances(snapshot: TemplateResumeDataInput, definition: TemplateDefinition, referenceDate: string) {
  const host = document.createElement('div')
  host.id = 'edge-instances'
  document.body.append(host)
  const data = buildTemplateResumeData(snapshot)
  const left = structuredClone(definition)
  const right = structuredClone(definition)
  left.tokens.primary = '#aa0000'
  right.tokens.primary = '#0044aa'
  const leftAppearance = { ...left.appearanceDefaults, font: { ...left.appearanceDefaults.font, fontSize: 12 }, theme: { theme: 'default' as const } }
  const rightAppearance = { ...right.appearanceDefaults, font: { ...right.appearanceDefaults.font, fontSize: 20 }, theme: { theme: 'default' as const } }
  createRoot(host).render(
    <div style={{ display: 'flex', gap: 20 }}>
      <div data-edge-instance="left" style={{ width: 550 }}><ResumeTemplateRuntime data={data} definition={left} appearance={leftAppearance} projectionReferenceDate={referenceDate} /></div>
      <div data-edge-instance="right" style={{ width: 550 }}><ResumeTemplateRuntime data={data} definition={right} appearance={rightAppearance} projectionReferenceDate={referenceDate} /></div>
    </div>,
  )
}
