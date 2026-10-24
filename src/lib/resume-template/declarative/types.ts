import type {
  ContentBlock,
  ContentField,
  ContentSection,
  ExperienceContent,
  ProfileContent,
  SkillContent,
} from '../content/types'
import type { ResumeAppearanceConfig } from '@/lib/schema'

export type TemplateContract = 'declarative-page@1'

export type ContentKind = ContentBlock['kind']

export type NumericToken =
  | 'pageMargin'
  | 'fontSize'
  | 'nameSize'
  | 'contentSize'
  | 'smallSize'
  | 'lineHeight'
  | 'sectionSpacing'
  | 'entrySpacing'
  | 'paragraphSpacing'
  | 'normalWeight'
  | 'mediumWeight'
  | 'boldWeight'

export type ColorToken =
  | 'primary'
  | 'accent'
  | 'text'
  | 'secondary'
  | 'muted'
  | 'track'
  | 'badge'

export type StyleValue =
  | number
  | { token: NumericToken; factor?: number; add?: number }

export type ColorValue = `#${string}` | { token: ColorToken }

export interface TemplateStyle {
  fontSize?: StyleValue
  fontWeight?: StyleValue
  lineHeight?: StyleValue
  color?: ColorValue
  backgroundColor?: ColorValue
  borderColor?: ColorValue
  borderWidth?: StyleValue
  borderTopWidth?: StyleValue
  borderRightWidth?: StyleValue
  borderBottomWidth?: StyleValue
  borderLeftWidth?: StyleValue
  borderTopLeftRadius?: StyleValue
  borderTopRightRadius?: StyleValue
  borderBottomLeftRadius?: StyleValue
  borderBottomRightRadius?: StyleValue
  letterSpacing?: StyleValue
  opacity?: number
  borderStyle?: 'solid' | 'dashed' | 'dotted'
  boxShadow?: {
    x: number
    y: number
    blur: number
    spread: number
    color: ColorValue
    opacity: number
  }
  rotate?: number
  borderRadius?: StyleValue
  padding?: StyleValue
  paddingTop?: StyleValue
  paddingRight?: StyleValue
  paddingBottom?: StyleValue
  paddingLeft?: StyleValue
  marginTop?: StyleValue
  marginRight?: StyleValue
  marginBottom?: StyleValue
  marginLeft?: StyleValue
  gap?: StyleValue
  columnGap?: StyleValue
  rowGap?: StyleValue
  width?: StyleValue
  height?: StyleValue
  minWidth?: StyleValue
  maxWidth?: StyleValue
  flexGrow?: StyleValue
  flexShrink?: StyleValue
  textAlign?: 'left' | 'center' | 'right'
  alignItems?: 'start' | 'center' | 'end' | 'baseline' | 'stretch'
  justifyContent?: 'start' | 'center' | 'end' | 'space-between'
  whiteSpace?: 'normal' | 'pre-wrap' | 'nowrap'
  columns?: number[]
}

export type FieldBinding =
  | 'profile.name'
  | 'profile.workYears'
  | 'item'
  | 'item.field'
  | 'item.title'
  | 'item.subtitle'
  | 'item.duration'

export type TextBinding =
  | 'section.key'
  | 'section.index'
  | 'item.index'
  | 'item.first'
  | 'item.last'
  | 'item.fieldKey'
  | 'section.title'
  | 'item.label'
  | 'item.percentage'
  | 'item.proficiency'

export type RichTextBinding = 'block.richText' | 'item.description'

export const RICH_TEXT_STYLE_ELEMENTS = [
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'code',
  'a',
  'blockquote',
] as const

export type RichTextStyleElement = (typeof RICH_TEXT_STYLE_ELEMENTS)[number]

export type ListBinding =
  | 'profile.fields'
  | 'profile.jobIntent'
  | 'profile.meta'
  | 'profile.contact'
  | 'block.items'

export type Binding =
  | FieldBinding
  | TextBinding
  | RichTextBinding
  | ListBinding
  | 'profile.photo'
  | 'profile'
  | 'sections'
  | 'item.displayType'
  | 'item.parity'

export interface TemplateCondition {
  binding: Binding
  operator: 'present' | 'equals'
  value?: string
}

interface NodeBase {
  id: string
  style?: string
  when?: TemplateCondition
  atomic?: boolean
  keepWithNext?: boolean
  sectionTarget?: 'basics'
}

export type TemplateShape =
  | {
      kind: 'rect'
      x: number
      y: number
      width: number
      height: number
      radius?: number
      fill?: ColorValue
      stroke?: ColorValue
      strokeWidth?: number
      opacity?: number
    }
  | {
      kind: 'circle'
      cx: number
      cy: number
      radius: number
      fill?: ColorValue
      stroke?: ColorValue
      strokeWidth?: number
      opacity?: number
    }
  | {
      kind: 'path'
      d: string
      fill?: ColorValue
      stroke?: ColorValue
      strokeWidth?: number
      opacity?: number
    }

export type TemplateNode =
  | (NodeBase & {
      type: 'box'
      layout: 'stack' | 'row' | 'wrap' | 'grid'
      children: TemplateNode[]
      decoration?: TemplateShape[]
      viewBox?: [number, number, number, number]
    })
  | (NodeBase & {
      type: 'text'
      text?: string
      binding?: TextBinding
      map?: Record<string, string>
      format?: 'pad2'
    })
  | (NodeBase & {
      type: 'field'
      binding: FieldBinding
      projection?: 'primary' | 'display'
      showLabel?: boolean
      suffix?: string
    })
  | (NodeBase & {
      type: 'richText'
      binding: RichTextBinding
      projection?: 'primary' | 'display'
      elementStyles?: Partial<Record<RichTextStyleElement, string>>
    })
  | (NodeBase & {
      type: 'repeat'
      source: ListBinding
      fieldOrder?: string[]
      fieldKeys?: string[]
      separator?: string
      layout: 'stack' | 'row' | 'wrap' | 'grid'
      children: TemplateNode[]
    })
  | (NodeBase & { type: 'sections' })
  | (NodeBase & { type: 'blocks' })
  | (NodeBase & {
      type: 'shape'
      viewBox: [number, number, number, number]
      shapes: TemplateShape[]
      binding?: 'section.key' | 'item.fieldKey'
      variants?: Record<string, TemplateShape[]>
    })
  | (NodeBase & {
      type: 'meter'
      binding: 'item.percentage'
      track: ColorValue
      fill: ColorValue
    })
  | (NodeBase & { type: 'photo'; alt?: string })
  | (NodeBase & { type: 'image'; asset: string; alt: string })

export interface TemplateAsset {
  id: string
  sha256: string
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  bytes: number
  width: number
  height: number
  required: boolean
}

export interface TemplateRegion {
  id: string
  width: number
  sections: string[] | 'remaining'
  padding?: [StyleValue, StyleValue, StyleValue, StyleValue]
  background?: ColorValue
  document?: TemplateNode[]
  section?: TemplateNode[]
  contentByKind?: Partial<Record<ContentKind, TemplateNode[]>>
}

export interface TemplatePage {
  fullBleed: boolean
  gap: number
  background?: ColorValue
  decoration?: TemplateShape[]
  decorationFirstPageOnly?: boolean
  pattern?: {
    kind: 'dots'
    color: ColorValue
    spacing: number
    radius: number
    opacity: number
  }
  regions: TemplateRegion[]
}

export interface TemplateDefinition {
  schemaVersion: 3
  templateId: string
  version: number
  renderContract: TemplateContract
  capabilities: string[]
  page: TemplatePage
  document: TemplateNode[]
  section: TemplateNode[]
  contentByKind: Record<ContentKind, TemplateNode[]>
  styles: Record<string, TemplateStyle>
  tokens: { primary: `#${string}`; accent: `#${string}` }
  assets: TemplateAsset[]
  appearanceDefaults: ResumeAppearanceConfig
}

export interface RenderScope {
  region?: TemplateRegion
  sectionIndex?: number
  itemIndex?: number
  itemCount?: number
  itemLabelVisible?: boolean
  profile?: ProfileContent | null
  sections?: ContentSection[]
  section?: ContentSection
  block?: ContentBlock
  item?: ExperienceContent | SkillContent | ContentField
}
