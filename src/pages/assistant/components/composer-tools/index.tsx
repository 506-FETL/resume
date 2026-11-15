/* eslint-disable react-refresh/only-export-components -- 菜单项包含图标的静态目录，不导出组件。 */
import type { ComposerTool } from '../../types'
import {
  BarChart3,
  Compass,
  ListChecks,
  Sparkles,
  Star,
  Target,
  UserRound,
  WandSparkles,
} from 'lucide-react'
import { COMMAND_COLORS } from '@/lib/ai/commands'
import { cn } from '@/lib/utils'
import { BUILTIN_SKILLS } from '@/lib/ai/skills/catalog'

// Slash 与工具菜单共用显示目录，选择结果保存为引用标签。
// 每个工具配置独立图标，避免下拉里所有条目都是同一个「工具」图标。
export const ASSISTANT_TOOLS: ComposerTool[] = [
  {
    name: '优化这段经历',
    category: '经历',
    description: '润色工作或项目经历',
    icon: (
      <Sparkles
        className={cn('size-5', COMMAND_COLORS['polish-experience'].icon)}
      />
    ),
  },
  {
    name: '生成 STAR 描述',
    category: '经历',
    description: '按背景、任务、行动和结果整理经历',
    icon: (
      <Star className={cn('size-5', COMMAND_COLORS['star-experience'].icon)} />
    ),
  },
  {
    name: '写清工作成果',
    category: '经历',
    description: '聊聊做了什么，再写出具体成果',
    icon: (
      <BarChart3
        className={cn('size-5', COMMAND_COLORS['clarify-results'].icon)}
      />
    ),
  },
  {
    name: '按 JD 匹配简历',
    category: '匹配',
    description: '对照岗位要求分析差距',
    icon: <Target className={cn('size-5', COMMAND_COLORS['match-job'].icon)} />,
  },
  {
    name: '提炼核心技能',
    category: '匹配',
    description: '根据目标岗位提炼并排序关键技能',
    icon: (
      <ListChecks
        className={cn('size-5', COMMAND_COLORS['extract-skills'].icon)}
      />
    ),
  },
  {
    name: '生成自我评价',
    category: '简历',
    description: '基于当前简历生成',
    icon: (
      <UserRound
        className={cn('size-5', COMMAND_COLORS['write-summary'].icon)}
      />
    ),
  },
  {
    name: '润色求职意向',
    category: '简历',
    description: '润色当前简历中的求职意向',
    icon: (
      <Compass
        className={cn('size-5', COMMAND_COLORS['polish-objective'].icon)}
      />
    ),
  },
  ...BUILTIN_SKILLS.map((skill) => ({
    name: skill.id,
    displayName: `${skill.displayName} · $${skill.id}`,
    category: '技能',
    description: skill.description,
    sourceLabel: skill.sourceLabel,
    skillId: skill.id,
    aliases: [skill.displayName, 'asu', 'asu-resume', skill.id],
    icon: <WandSparkles className='size-5 text-violet-500' />,
  })),
]

export { TEMPLATE_PROMPTS } from '@/lib/ai/commands'
