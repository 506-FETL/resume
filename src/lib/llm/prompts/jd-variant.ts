// TODO(Task 8): replace this module-private placeholder by importing
// `EditableResumeView` from '@/components/jd-variant/types' once defined.
type EditableResumeView = Record<string, unknown>

export interface JdPromptPair {
  system: string
  user: string
}

export function buildJdParsePrompt(jdText: string): JdPromptPair {
  const system = `你是资深 HR / 求职顾问，擅长从岗位描述（JD）中提炼关键词。
你的任务：从用户给出的 JD 文本中，提炼 3~30 个关键词，并给出一句岗位画像。
关键词必须满足：
1. 与岗位职责、技术栈、软技能、行业词强相关；忽略福利、工作时间、HR 套话。
2. 中英混排：技术名（如 React、TypeScript）保留原样；中文概念用中文。
3. 单个关键词长度 ≤ 12 字符，去重后输出。
4. 重要度高的排在前面。

输出协议（必须严格遵守，不要任何解释、不要 markdown 代码块）：
{
  "keywords": ["...", "...", ...],
  "summary": "（一句岗位画像，≤ 30 字）"
}`

  const user = `JD 文本如下：\n"""\n${jdText}\n"""\n\n请只输出 JSON 对象。`
  return { system, user }
}

interface BuildJdRewritePromptArgs {
  resumeJson: EditableResumeView
  jdText: string
  keywords: readonly string[]
}

export function buildJdRewritePrompt(args: BuildJdRewritePromptArgs): JdPromptPair {
  const system = `你是资深简历优化顾问，擅长把现有简历针对特定岗位做"局部精修"。

【可改写字段白名单（严格遵守）】
- basics.summary
- job_intent
- skill_specialty
- self_evaluation
- work_experience.*.bullets / description
- internship_experience.*.bullets / description
- project_experience.*.description / techStack
- campus_experience.*.description

【绝对禁止改动的字段】
- basics.name / basics.phone / basics.email / basics.gender / basics.birthday / basics.location / basics.avatar
- edu_background（学校、专业、时间、绩点）
- honors_certificates、application_info
- 任意时间、公司名、学校名、岗位 title、项目 title

【改写硬规则】
1. 改写必须基于原文事实，禁止伪造经历、伪造数据、伪造技术栈使用经验。
2. 必须命中至少一个 JD 关键词；命中关键词写入 matchedKeywords。
3. after 长度 ≤ before 长度 × 1.5。
4. 总 change 数：3 ≤ N ≤ 15。
5. itemId 必须严格使用输入 resumeJson 中的 id；section 必须在白名单内。
6. before 必须与输入完全一致（字符级），用于服务端二次校验。
7. reason 用中文，≤ 60 字。

【输出协议】（不要任何解释、不要 markdown 代码块）
{ "changes": [{ "section": "...", "itemId": "...", "fieldPath": "...",
  "before": "...", "after": "...", "matchedKeywords": ["..."], "reason": "..." }] }`

  const user = `候选简历（JSON，仅含可改写字段，请按 itemId 索引）：\n${JSON.stringify(args.resumeJson, null, 2)}\n\nJD 关键词（按重要度降序）：${args.keywords.join('、')}\n\nJD 原文：\n"""\n${args.jdText}\n"""\n\n请只输出 JSON 对象。`
  return { system, user }
}
