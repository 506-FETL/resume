export interface SkillResource {
  path: string
  title: string
}

export interface SkillDefinition {
  id: string
  version: string
  displayName: string
  description: string
  sourceLabel: string
  sourceUrl: string
  resources: readonly SkillResource[]
}

export interface LoadedSkill extends SkillDefinition {
  instructions: string
}

export interface LoadedSkillResource extends SkillResource {
  content: string
}
