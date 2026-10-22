import type { CommentAnchorDocumentNode } from '@/features/resume-comments/anchors/types'
import type { ResumeSchema, SkillItem } from '@/lib/schema'

export type CommentNodes = ReadonlyMap<string, CommentAnchorDocumentNode>
export interface ContentField {
  sectionKey: keyof ResumeSchema
  entryId: string
  fieldKey: string
  nodeKey: string
  label: string
  text: string
}
export interface ExperienceContent {
  entryId: string
  title?: ContentField
  subtitle?: ContentField
  duration?: ContentField
  description?: { field: ContentField, html: string }
}
export interface SkillContent {
  field: ContentField
  proficiencyLevel: SkillItem['proficiencyLevel']
  displayType: SkillItem['displayType']
}
export type ContentBlock
  = | { kind: 'experience', items: ExperienceContent[] }
    | { kind: 'richText', field: ContentField, html: string }
    | { kind: 'skills', items: SkillContent[] }
    | { kind: 'fieldList', items: ContentField[] }
    | { kind: 'tagList', items: ContentField[] }
export interface ContentSection {
  key: keyof ResumeSchema
  title: string
  blocks: ContentBlock[]
}
export interface ProfileContent {
  fields: ContentField[]
  name?: ContentField
  workYears?: ContentField
  jobIntent: ContentField[]
  meta: ContentField[]
  contact: ContentField[]
}
export interface AdaptedResumeContent {
  profile: ProfileContent | null
  sections: ContentSection[]
}

export function contentField(nodes: CommentNodes, sectionKey: keyof ResumeSchema, entryId: string, fieldKey: string, label: string): ContentField {
  const nodeKey = `${sectionKey}/${entryId}/${fieldKey}`
  return { sectionKey, entryId, fieldKey, nodeKey, label, text: nodes.get(nodeKey)?.text ?? '' }
}
