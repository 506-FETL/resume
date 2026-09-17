import { getSkillDefinition } from './catalog.ts'

export function getSkillToolLabel(name: string, args: unknown): string | undefined {
  if (name !== 'activate_skill' && name !== 'read_skill_resource')
    return undefined
  const data = args && typeof args === 'object' ? args as Record<string, unknown> : {}
  const skill = typeof data.skillId === 'string' ? getSkillDefinition(data.skillId) : undefined
  if (name === 'activate_skill')
    return skill ? `加载 ${skill.displayName}` : '加载技能'
  const resource = skill?.resources.find(resource => resource.path === data.path)
  return resource ? `读取${resource.title}` : '读取技能参考资料'
}
