export interface AssistantCommand {
  id: string
  displayName: string
  version: string
  prompt: string
}

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

export const ASSISTANT_COMMANDS: readonly AssistantCommand[] = [
  ['polish-experience', '优化这段经历'],
  ['star-experience', '生成 STAR 描述'],
  ['clarify-results', '写清工作成果'],
  ['match-job', '按 JD 匹配简历'],
  ['extract-skills', '提炼核心技能'],
  ['write-summary', '生成自我评价'],
  ['polish-objective', '润色求职意向'],
].map(([id, displayName]) => ({
  id,
  displayName,
  version: '1.0.0',
  prompt: TEMPLATE_PROMPTS[displayName].trim(),
}))

export const COMMAND_COLORS: Record<string, { icon: string; tag: string }> = {
  'polish-experience': {
    icon: 'text-amber-500',
    tag: 'border-amber-200/80 bg-amber-50/70 text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200',
  },
  'star-experience': {
    icon: 'text-yellow-500',
    tag: 'border-yellow-200/80 bg-yellow-50/70 text-yellow-800 dark:border-yellow-400/25 dark:bg-yellow-400/10 dark:text-yellow-200',
  },
  'clarify-results': {
    icon: 'text-emerald-500',
    tag: 'border-emerald-200/80 bg-emerald-50/70 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200',
  },
  'match-job': {
    icon: 'text-rose-500',
    tag: 'border-rose-200/80 bg-rose-50/70 text-rose-800 dark:border-rose-400/25 dark:bg-rose-400/10 dark:text-rose-200',
  },
  'extract-skills': {
    icon: 'text-sky-500',
    tag: 'border-sky-200/80 bg-sky-50/70 text-sky-800 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-200',
  },
  'write-summary': {
    icon: 'text-violet-500',
    tag: 'border-violet-200/80 bg-violet-50/70 text-violet-800 dark:border-violet-400/25 dark:bg-violet-400/10 dark:text-violet-200',
  },
  'polish-objective': {
    icon: 'text-cyan-500',
    tag: 'border-cyan-200/80 bg-cyan-50/70 text-cyan-800 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-200',
  },
}
