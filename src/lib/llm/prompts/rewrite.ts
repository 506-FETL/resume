import type {
  RewriteAction,
  RewriteFieldContext,
} from '@/components/ai-rewrite/types'

const ACTION_INSTRUCTIONS: Record<RewriteAction, string> = {
  star_rewrite: `请将原文按 STAR 法则重写：
- Situation：当时的业务背景或挑战（1 句）
- Task：你需要解决的目标或职责（1 句）
- Action：你做了什么具体动作、用了什么技术 / 方法（必须具体到工具、流程、决策）
- Result：带来的结果，必须包含可量化指标
当原文缺失某个 STAR 元素时，使用占位符 "（待补充：XX）"，禁止编造数字、公司、产品名。`,
  quantify: `请在保留原意的前提下，把模糊描述改写为带量化指标的表达：
- 添加百分比、数量、时间、规模、节省成本等可衡量数据
- 原文已有数字时不得改写为不同的数字
- 原文确无数据时使用占位符 "（待补充：XX%）"，不得编造`,
  strong_verb: `请将原文中的弱动词替换为更专业的强动词，并保留原意：
- 弱动词列表：负责、参与、协助、完成、做、搞、处理、跟进
- 强动词候选：主导、驱动、架构、交付、营造、推进、收敛、落地、攻克
- 不得改变事实，只更换动词及其搭配`,
  polish: `请润色并精简原文：
- 句子变短、节奏更紧凑
- 修正语法错误和标点
- 不得新增事实信息，不得删除任何已有指标 / 公司 / 技术名`,
  align_jd: `请把原文向给定的岗位描述（JD）靠拢改写：
- 在保留原文已有事实的前提下，加强 JD 关注的关键词覆盖
- 突出 JD 高频出现的技术 / 职责 / 行业术语
- 不得编造原文不存在的项目经历或数字`,
}

interface BuildArgs {
  action: RewriteAction
  selectionText: string
  selectionHtml: string
  fieldContext: RewriteFieldContext
  jdDraft?: string
}

export function buildRewritePrompt(args: BuildArgs): string {
  const { action, selectionText, selectionHtml, fieldContext, jdDraft } = args
  const sections: string[] = []

  sections.push(
    `你是一个简历内容改写专家。当前用户正在编辑「${fieldContext.fieldLabel}」字段。`,
  )
  if (fieldContext.jobIntent?.trim()) {
    sections.push(`用户的求职意向：${fieldContext.jobIntent.trim()}`)
  }
  sections.push(`你的任务：\n${ACTION_INSTRUCTIONS[action]}`)

  if (action === 'align_jd' && jdDraft?.trim()) {
    sections.push(`目标岗位描述（JD）：\n${jdDraft.trim()}`)
  }

  sections.push(`原文（HTML）：\n${selectionHtml}`)
  sections.push(`原文（纯文本，仅供理解）：\n${selectionText}`)

  sections.push(`========== 输出硬规则 ==========
1) 仅输出 1 个合法 JSON 对象，结构严格如下：
{
  "candidates": [
    { "title": "字符串，10 字内，概括本候选的差异点", "html": "字符串，必须是合法 HTML，能直接替换原文", "notes": "字符串，最多 2 句，说明改写要点" }
  ]
}
2) candidates 长度必须为 2 或 3。
3) 每个 candidate 的 html 必须保留与原文相同的根级结构（原文是 <ul> 则保持 <ul>，原文是若干 <p> 则保持 <p>）。
4) 不输出 Markdown、不输出代码块、不输出 JSON 之外的任何文字。
5) 禁止编造姓名、公司、学校、产品名、奖项、证书、具体数字。缺失数据用 "（待补充：XX）"。
6) 不同 candidate 的 title 必须互不重复。
7) 输出语言必须是中文。`)

  return sections.join('\n\n')
}
