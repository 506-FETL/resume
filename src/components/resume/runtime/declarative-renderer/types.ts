import type {
  TemplateDefinition,
  TemplateNode,
  RenderScope,
} from '@/lib/resume-template/declarative/types'
import type { AdaptedResumeContent } from '@/lib/resume-template/content/types'
import type { TemplateStyleEnvironment } from '@/lib/resume-template/declarative/styles'
import type { completeProfileFields } from '@/lib/resume-template/declarative/complete-profile-fields'
import type { CSSProperties, ReactNode } from 'react'

export interface DeclarativeRendererProps {
  definition: TemplateDefinition
  content: AdaptedResumeContent
  environment: TemplateStyleEnvironment
  assetUrls?: ReadonlyMap<string, string>
}

export interface TemplateRenderContext {
  definition: TemplateDefinition
  environment: TemplateStyleEnvironment
  assetUrls?: ReadonlyMap<string, string>
  additionalProfileFields: ReturnType<typeof completeProfileFields>
  chargeNodes: (count: number) => void
  claimProjection: (key: string, projection?: string) => void
}

export interface NodePresentation {
  style: CSSProperties
  paint: ReactNode
  common: {
    'data-pagination-keep-with-next': boolean | undefined
    id: string | undefined
    'data-section': string | undefined
    'data-layout-node': string
    'data-pagination-atomic': boolean | undefined
  }
}

export type RenderNodes = (
  nodes: TemplateNode[],
  scope: RenderScope,
) => ReactNode[]
