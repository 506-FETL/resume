import type { Tool } from '@/components/ui/composer'
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
import { BUILTIN_SKILLS } from '@/lib/ai/skills/catalog'

// AI 求职助手的快捷指令（Slash / 工具按钮共用）。选中后把中文提示词模板填入输入框。
// 每个工具配置独立图标，避免下拉里所有条目都是同一个「工具」图标。
export const ASSISTANT_TOOLS: Tool[] = [
  {
    name: '优化这段经历',
    category: '经历',
    description: '润色工作或项目经历',
    icon: <Sparkles className='size-5 text-amber-500' />,
  },
  {
    name: '生成 STAR 描述',
    category: '经历',
    description: '按背景、任务、行动和结果整理经历',
    icon: <Star className='size-5 text-yellow-500' />,
  },
  {
    name: '写清工作成果',
    category: '经历',
    description: '聊聊做了什么，再写出具体成果',
    icon: <BarChart3 className='size-5 text-emerald-500' />,
  },
  {
    name: '按 JD 匹配简历',
    category: '匹配',
    description: '对照岗位要求分析差距',
    icon: <Target className='size-5 text-rose-500' />,
  },
  {
    name: '提炼核心技能',
    category: '匹配',
    description: '根据目标岗位提炼并排序关键技能',
    icon: <ListChecks className='size-5 text-sky-500' />,
  },
  {
    name: '生成自我评价',
    category: '简历',
    description: '基于当前简历生成',
    icon: <UserRound className='size-5 text-violet-500' />,
  },
  {
    name: '润色求职意向',
    category: '简历',
    description: '润色当前简历中的求职意向',
    icon: <Compass className='size-5 text-cyan-500' />,
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

// 快捷指令 → 中文提示词模板（填入输入框，待用户补全或直接发送）
export const TEMPLATE_PROMPTS: Record<string, string> = {
  优化这段经历:
    '请帮我改写下面这段经历，让它更清楚、好读。保留我实际做过的工作和成果；不清楚的地方先问我，不要添加未经我确认的经历、技能或数字：\n\n',
  '生成 STAR 描述':
    '请按 STAR（背景、任务、行动、结果）整理下面这段经历。缺少背景、我做过的事或结果时，先问我。只使用我提供或确认的事实，不编造数字；没有数据时，可以写实际完成的工作或解决的问题：\n\n',
  写清工作成果:
    '请帮我把下面这段经历里的成果写清楚。先问清楚我负责哪部分、做了什么、结果怎样，有没有能核实的记录。只使用我提供或确认的事实，不要编造数字，也不要把团队的全部成果写成我个人完成的。没有数据时，可以写实际完成的工作或解决的问题：\n\n',
  '按 JD 匹配简历':
    '请对照下面的岗位要求，看看我的简历有哪些相关经验，哪些地方还需要补充或修改：\n\n【岗位要求】\n',
  提炼核心技能: '请从我的简历里找出与目标岗位相关的技能，把最重要的排在前面。',
  生成自我评价:
    '请根据我正在编辑的简历，用 3～4 句话写一段自我评价。写出具体经验和擅长的事，避免空泛的自夸。',
  润色求职意向: '请帮我改写简历中的求职意向，说清楚我想应聘什么岗位。',
}
