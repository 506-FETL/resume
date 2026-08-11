import type { ReactNode } from 'react'
import type { TemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import type { ResolvedTemplateManifest, TemplateManifest } from '@/lib/resume-template/schema'
import type { ResumeAppearanceConfig } from '@/lib/schema'
import { layoutSkeletonRegistry } from '@/lib/resume-template/registry/layout-skeletons'
import { sectionRendererOrderKeyMap, sectionRendererRegistry } from '@/lib/resume-template/registry/section-renderers'
import { resolveTemplateManifest } from '@/lib/resume-template/runtime'
import { TemplateRuntimeProviders } from './TemplateRuntimeProviders'

function renderSection(section: ResolvedTemplateManifest['sections'][number], data: TemplateResumeData) {
  const Renderer = sectionRendererRegistry[section.renderer]
  const orderKey = sectionRendererOrderKeyMap[section.renderer]

  if (!Renderer || !section.visible) {
    return null
  }

  if (orderKey && !data.order.includes(orderKey)) {
    return null
  }

  return (
    <div key={`${section.sectionId}-${section.order}`} data-section={orderKey ?? section.renderer}>
      <Renderer />
    </div>
  )
}

export function ResumeTemplateRuntime({
  data,
  manifest,
  appearance,
}: {
  data: TemplateResumeData
  manifest: TemplateManifest
  appearance?: Partial<ResumeAppearanceConfig> | null
}) {
  const resolvedManifest = resolveTemplateManifest(manifest)
  const layout = layoutSkeletonRegistry[resolvedManifest.layout.skeleton]
  const mainSections: ReactNode[] = []
  const sidebarSections: ReactNode[] = []
  let header: ReactNode = null

  const orderedSections = [...resolvedManifest.sections].sort((left, right) => {
    const leftKey = sectionRendererOrderKeyMap[left.renderer]
    const rightKey = sectionRendererOrderKeyMap[right.renderer]
    const leftIndex = leftKey ? data.order.indexOf(leftKey) : -1
    const rightIndex = rightKey ? data.order.indexOf(rightKey) : -1

    if (leftIndex !== -1 && rightIndex !== -1)
      return leftIndex - rightIndex
    if (leftIndex !== -1)
      return -1
    if (rightIndex !== -1)
      return 1
    return left.order - right.order
  })

  for (const section of orderedSections) {
    const node = renderSection(section, data)
    if (!node) {
      continue
    }

    if (section.renderer === 'basics') {
      header = node
      continue
    }

    if (section.region === 'sidebar') {
      sidebarSections.push(node)
      continue
    }

    mainSections.push(node)
  }

  return (
    <TemplateRuntimeProviders
      data={data}
      appearance={appearance}
      layout={resolvedManifest.layout}
    >
      {layout({
        manifest: resolvedManifest,
        header,
        main: <>{mainSections}</>,
        sidebar: sidebarSections.length > 0 ? <>{sidebarSections}</> : null,
      })}
    </TemplateRuntimeProviders>
  )
}
