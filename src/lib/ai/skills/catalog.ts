import type { SkillDefinition } from './types'

export const BUILTIN_SKILLS: readonly SkillDefinition[] = [
  {
    id: 'great-resume',
    version: '1.0.0',
    displayName: 'ASu 简历提升',
    description: '基于真实经历和证据边界，重组岗位定位、简历要点与求职沟通文案。',
    sourceLabel: 'Hisn00w/ASu-skills（MIT，产品适配）',
    sourceUrl: 'https://github.com/Hisn00w/ASu-skills/tree/fb7f6cc443b3618f1944ff9897597a58e4ca083b/skills/great-resume',
    resources: [
      { path: 'references/claim-evidence-ledger.md', title: '主张与证据清单' },
      { path: 'references/business-analysis-evidence.md', title: '商业分析经历证据工作流' },
    ],
  },
]

export function getSkillDefinition(id: string): SkillDefinition | undefined {
  return BUILTIN_SKILLS.find(skill => skill.id === id)
}
