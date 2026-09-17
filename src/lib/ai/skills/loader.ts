import type { LoadedSkill, LoadedSkillResource, SkillDefinition } from './types'
import { getSkillDefinition } from './catalog'

interface RawMarkdownModule { default: string }

const resourceLoaders: Record<string, () => Promise<RawMarkdownModule>> = {
  'references/claim-evidence-ledger.md': () => import('./builtin/great-resume/references/claim-evidence-ledger.md?raw'),
  'references/business-analysis-evidence.md': () => import('./builtin/great-resume/references/business-analysis-evidence.md?raw'),
}

function requireSkill(id: string, version?: string): SkillDefinition {
  const skill = getSkillDefinition(id)
  if (!skill)
    throw new Error(`未找到内置技能「${id}」`)

  if (version !== undefined && version !== skill.version)
    throw new Error(`技能「${id}」不支持版本「${version}」`)

  return skill
}

function isUnsafeResourcePath(path: string): boolean {
  return path.startsWith('/')
    || path.includes('\\')
    || path.split('/').includes('..')
    || /^[a-z][a-z\d+.-]*:/i.test(path)
}

export async function loadSkill(id: string, version?: string): Promise<LoadedSkill> {
  const skill = requireSkill(id, version)
  const { default: instructions } = await import('./builtin/great-resume/SKILL.md?raw')
  return { ...skill, instructions }
}

export async function readSkillResource(
  id: string,
  path: string,
  version?: string,
): Promise<LoadedSkillResource> {
  const skill = requireSkill(id, version)
  if (isUnsafeResourcePath(path))
    throw new Error(`技能「${id}」拒绝读取不安全资料路径「${path}」`)

  const resource = skill.resources.find(item => item.path === path)
  const loader = resource && resourceLoaders[resource.path]
  if (!resource || !loader)
    throw new Error(`技能「${id}」未声明资料「${path}」`)

  const { default: content } = await loader()
  return { ...resource, content }
}
