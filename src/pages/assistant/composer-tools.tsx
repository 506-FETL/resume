import type { Tool } from '@/components/ui/composer'
import { BarChart3, Compass, ListChecks, Sparkles, Star, Target, UserRound } from 'lucide-react'

// AI 求职助手的快捷指令（Slash / 工具按钮共用）。选中后把中文提示词模板填入输入框。
// 每个工具配置独立图标，避免下拉里所有条目都是同一个「工具」图标。
export const ASSISTANT_TOOLS: Tool[] = [
  { name: '优化这段经历', category: '经历', description: '润色并强化一段工作/项目经历的表达', icon: <Sparkles className="size-5 text-amber-500" /> },
  { name: '生成 STAR 描述', category: '经历', description: '用 STAR 结构重写经历，突出成果与量化', icon: <Star className="size-5 text-yellow-500" /> },
  { name: '量化成果', category: '经历', description: '为经历补充可量化的数据与指标', icon: <BarChart3 className="size-5 text-emerald-500" /> },
  { name: '按 JD 匹配简历', category: '匹配', description: '对照岗位 JD 分析匹配度并给出优化建议', icon: <Target className="size-5 text-rose-500" /> },
  { name: '提炼核心技能', category: '匹配', description: '根据目标岗位提炼并排序关键技能', icon: <ListChecks className="size-5 text-sky-500" /> },
  { name: '生成自我评价', category: '简历', description: '基于当前简历生成一段简洁有力的自我评价', icon: <UserRound className="size-5 text-violet-500" /> },
  { name: '润色求职意向', category: '简历', description: '优化求职意向的表达，使其更聚焦', icon: <Compass className="size-5 text-cyan-500" /> },
]

// 快捷指令 → 中文提示词模板（填入输入框，待用户补全或直接发送）
export const TEMPLATE_PROMPTS: Record<string, string> = {
  '优化这段经历': '请帮我优化下面这段经历的表达，使其更专业、更有说服力（保留真实信息，突出职责与成果）：\n\n',
  '生成 STAR 描述': '请用 STAR（情境-任务-行动-结果）结构，把下面这段经历改写为一条条清晰、量化的简历要点：\n\n',
  '量化成果': '请帮我为下面这段经历补充可量化的成果与指标（如百分比、金额、规模、时长等），使描述更有冲击力：\n\n',
  '按 JD 匹配简历': '请对照下面这份岗位 JD，分析我当前简历的匹配度，指出差距并给出可执行的优化建议：\n\n【JD】\n',
  '提炼核心技能': '请根据我的目标岗位，从我的简历中提炼并按重要性排序出最关键的核心技能清单。',
  '生成自我评价': '请基于我当前正在编辑的简历，生成一段 3~4 句、简洁有力的自我评价。',
  '润色求职意向': '请帮我润色简历中的求职意向，使其更聚焦、更符合目标岗位。',
}
