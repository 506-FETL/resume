import type { AiMessagePart, AiSkillReference } from '../types.ts'
import { getSkillDefinition } from './catalog.ts'

const SKILL_ALIASES: Record<string, string> = {
  'asu': 'great-resume',
  'asu-resume': 'great-resume',
}

// 只识别独立的点名标记。保留原始文本，不改写用户的任务或材料。
function explicitSkillNames(text: string): string[] {
  const prose = text
    .replace(/```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')

  const names = [...prose.matchAll(/(?:^|\s)\$([a-z][a-z0-9-]*)(?=$|[\s，。！？、：；])/gi)]
    .map(match => match[1].toLowerCase())

  // Slash 仅在消息开头解释为技能命令，避免把普通路径当作技能。
  const slash = prose.match(/^\s*\/([a-z][a-z0-9-]*)(?=$|[\s，。！？、：；])/i)

  if (slash)
    names.push(slash[1].toLowerCase())

  return names
}

export function createSkillReferences(text: string, selectedIds: readonly string[] = []): AiSkillReference[] {
  const ids = [...selectedIds, ...explicitSkillNames(text)]
  const references = new Map<string, AiSkillReference>()

  for (const name of ids) {
    const id = SKILL_ALIASES[name] ?? name
    const skill = getSkillDefinition(id)

    if (!skill)
      throw new Error(`未找到技能「${name}」。请从技能菜单选择 ASu 简历提升，或移除这条技能指令。`)

    references.set(id, {
      type: 'skill-reference',
      skillId: skill.id,
      version: skill.version,
      displayName: skill.displayName,
    })
  }

  return [...references.values()]
}

export function getSkillReferences(parts: readonly AiMessagePart[]): AiSkillReference[] {
  return parts.filter((part): part is AiSkillReference => part.type === 'skill-reference')
}

export function getEditableMessageText(parts: readonly AiMessagePart[]): string {
  return parts.filter(part => part.type === 'text').map(part => part.text).join('\n')
}

export { createUserParts } from '../references.ts'
