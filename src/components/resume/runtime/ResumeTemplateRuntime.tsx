import type { ContentBlock } from '@/lib/resume-template/content/types'
import type { TemplateDefinition } from '@/lib/resume-template/definition-schema'
import type { TemplateManifest } from '@/lib/resume-template/schema'
import type { ResumeAppearanceConfig } from '@/lib/schema'
import type { TemplateResumeData } from './context/resume-data-context'
import { useMemo } from 'react'
import { parseSharedTemplateDefinition } from '@/lib/resume-template/compatibility/share-manifest'
import { adaptResumeContent } from '@/lib/resume-template/content/adapt-resume'
import { parseTemplateDefinition } from '@/lib/resume-template/definition-schema'
import { visualComponents } from '@/lib/resume-template/registry/visual-components'
import { DEFAULT_ORDER, normalizeResumeAppearance } from '@/lib/schema'
import { useResumeContext } from './context/resume-context'
import { TemplateRuntimeProviders } from './TemplateRuntimeProviders'

function ContentBlockView({ block, definition }: { block: ContentBlock, definition: TemplateDefinition }) {
  switch (block.kind) {
    case 'experience': {
      const Part = visualComponents.experience[definition.contentByKind.experience.component]
      return <Part items={block.items} />
    }
    case 'richText': {
      const Part = visualComponents.richText[definition.contentByKind.richText.component]
      return <Part field={block.field} html={block.html} />
    }
    case 'skills': {
      const Part = visualComponents.skills[definition.contentByKind.skills.component]
      return <Part items={block.items} />
    }
    case 'fieldList': {
      const Part = visualComponents.fieldList[definition.contentByKind.fieldList.component]
      return <Part items={block.items} />
    }
    case 'tagList': {
      const Part = visualComponents.tagList[definition.contentByKind.tagList.component]
      return <Part items={block.items} />
    }
  }
}

function ResumeContent({ data, definition }: { data: TemplateResumeData, definition: TemplateDefinition }) {
  const { commentNodesByKey, spacing } = useResumeContext()
  const content = useMemo(() => adaptResumeContent(data, commentNodesByKey), [data, commentNodesByKey])
  const Layout = visualComponents.layout[definition.layout.component]
  const Header = visualComponents.header[definition.header.component]
  const Heading = visualComponents.heading[definition.sectionHeading.component]
  const sectionsByKey = new Map(content.sections.map(section => [section.key, section]))
  // 默认模板原先为隐藏模块和页头已消费的求职信息保留外层占位。
  // 这些占位影响 flex gap 和分页，v1 必须保持其几何行为。
  const sectionSlots = data.order.filter(key => key !== 'basics' && DEFAULT_ORDER.includes(key))
  return (
    <Layout
      header={content.profile && <div data-section="basics"><Header profile={content.profile} /></div>}
      main={sectionSlots.map((key) => {
        const section = sectionsByKey.get(key)
        return (
        <div key={key} data-section={key}>
          {section && (
          <section id={`resume-section-${section.key}`}>
            <Heading title={section.title} />
            <div className="flex flex-col" style={{ gap: spacing.entrySpacing }}>
              {section.blocks.map((block, index) => <ContentBlockView key={`${block.kind}-${index}`} block={block} definition={definition} />)}
            </div>
          </section>
          )}
        </div>
        )
      })}
    />
  )
}

/** manifest 仅为迁移旧调用方的短期桥接；定义已解析的入口不再回退旧类型。 */
export function ResumeTemplateRuntime({ data, definition: definitionInput, manifest, appearance, projectionReferenceDate = new Date().toISOString().slice(0, 10) }: {
  data: TemplateResumeData
  definition?: TemplateDefinition
  manifest?: TemplateManifest
  appearance?: Partial<ResumeAppearanceConfig> | null
  projectionReferenceDate?: string
}) {
  const definition = useMemo(() => definitionInput ? parseTemplateDefinition(definitionInput) : parseSharedTemplateDefinition(manifest), [definitionInput, manifest])
  const effectiveAppearance = useMemo(() => normalizeResumeAppearance(appearance), [appearance])
  return (
    <TemplateRuntimeProviders
      data={data}
      appearance={effectiveAppearance}
      layout={{ skeleton: 'single-column', headerVariant: 'default', density: 'normal', page: { size: 'A4', pagePaddingToken: 'md' } }}
      projectionReferenceDate={projectionReferenceDate}
    >
      <ResumeContent data={data} definition={definition} />
    </TemplateRuntimeProviders>
  )
}
