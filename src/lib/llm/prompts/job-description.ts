export function createJobDescriptionAnalysisPrompt(
  resumeJson: string,
  jobDescription: string,
) {
  return `
你会收到两段输入：
1. 当前简历 JSON
2. 用户粘贴的岗位描述文本

你的唯一任务是：对照简历与岗位描述，输出 1 个严格合法的 JSON 对象，表示职位描述比对结果。

========================
1. 输出硬规则
========================
1) 只能输出 1 个 JSON 对象。
2) 不要输出 Markdown、不要输出代码块、不要输出解释文字。
3) 输出必须能被 JSON.parse 直接解析。
4) 不允许输出 schema 之外的字段。
5) 所有面向用户的文案都使用中文。
6) 不允许编造简历中不存在的经历、技能、项目、结果或指标。
7) "matchedKeywords" 里的关键词必须能在当前简历内容中找到依据。
8) "missingKeywords" 必须是 JD 里重要但简历未充分体现的关键词，不要滥填停用词或泛词。
9) "sectionMatches" 必须覆盖下面列出的全部 sectionKey，每个只出现一次：
   - "basics"
   - "job_intent"
   - "application_info"
   - "edu_background"
   - "work_experience"
   - "internship_experience"
   - "campus_experience"
   - "project_experience"
   - "skill_specialty"
   - "honors_certificates"
   - "self_evaluation"
   - "hobbies"

========================
2. 输出结构
========================
{
  "summary": "2~4 句中文总结，说明整体匹配情况、主要优势和核心缺口。",
  "strengths": ["2~4 条中文短句，说明简历对 JD 的亮点承接"],
  "risks": ["2~4 条中文短句，说明当前简历与 JD 的主要风险或缺口"],
  "matchScore": 0,
  "extractedKeywords": ["从 JD 提炼出的核心关键词，6~20 个，优先保留技能、职责、业务场景、岗位目标"],
  "matchedKeywords": ["已被简历承接的关键词，必须是 extractedKeywords 的子集"],
  "missingKeywords": ["简历尚未充分覆盖的关键词，必须来自 extractedKeywords"],
  "recommendations": ["3~5 条可执行建议，要具体到应该补什么、改哪里、如何表达"],
  "sectionMatches": [
    {
      "sectionKey": "work_experience",
      "coverage": 0,
      "matchedCount": 0,
      "matchedKeywords": ["..."],
      "analysis": "1 句中文，说明这个板块和 JD 的关系以及下一步建议"
    }
  ]
}

========================
3. 字段要求
========================
- summary：不要空泛，要明确说明这份简历为什么匹配或不匹配。
- strengths：没有明显亮点时也要基于事实写出相对优势，避免套话。
- risks：必须突出最影响投递结果的真实问题。
- matchScore：0~100 的整数，综合考虑关键词承接、经历相关性、技能匹配度、结果表达与岗位方向一致性。
- extractedKeywords：去重，避免"负责/熟悉/良好沟通"这类空泛词。
- matchedKeywords：去重，必须是 extractedKeywords 的子集。
- missingKeywords：去重，必须是 extractedKeywords 中未被 matchedKeywords 覆盖的部分。
- recommendations：每条都要能直接指导用户修改简历，不要只说"继续优化""增强匹配度"。
- sectionMatches[*].coverage：0~100 的整数。
- sectionMatches[*].matchedCount：整数，建议与 matchedKeywords.length 保持一致。
- sectionMatches[*].matchedKeywords：必须是 extractedKeywords 的子集。
- sectionMatches[*].analysis：结合板块现状说明承接情况，不能只是重复"命中 X 个关键词"。

========================
4. 分析原则
========================
- 先理解岗位核心目标，再看简历是否给出相应经历、技能和成果支撑。
- 如果简历和岗位方向接近，但证据不足，要在风险和建议里明确指出"表达不充分"而不是直接判定"不会"。
- 如果 JD 很短，也要尽量提炼核心方向，但不要为了凑数制造关键词。
- 优先关注这些维度：
  - 求职方向是否一致
  - 技术栈是否匹配
  - 业务场景和职责是否贴近
  - 是否有结果量化或影响证明
  - 哪些板块最值得补强

========================
5. 当前简历 JSON
========================
${resumeJson}

========================
6. 岗位描述
========================
${jobDescription.trim()}

========================
7. 最终要求
========================
只输出最终 JSON 对象。
`
}
