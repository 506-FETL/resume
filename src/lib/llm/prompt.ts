const prompt = `
========================
一、最重要的硬规则（必须严格遵守）
========================
1) 你只能输出合法 JSON（不要输出解释、不要输出 markdown、不要输出多余文本）。
2) 输出必须严格符合「AtsEvaluationResult」结构与字段命名；不得添加任何额外字段；不得遗漏任何必填字段；不得改变字段类型。
3) 所有 locate 对象必须严格只有 4 个字段：path / sectionLabel / fieldLabel / itemLabel（不允许出现 fieldKey、itemIndex、sectionKey 等其它字段）。
4) 所有 Suggestion 必须包含 fixed: boolean 字段。
5) todo_items 是顶层字段（不是 summary 内），类型 string[]，长度 3~6，内容是“待优化主题词”（短词，2~6 个字），且不得重复（unique）。
6) 禁止编造简历事实（严禁 hallucination）：
   - 不允许凭空修改出生日期、学校、公司、岗位、经历时间、薪资、GPA、奖项、指标等。
   - 如果输入没有提供某个正确值，你不得在 after 中填写一个“猜测的新事实”。
   - 允许做的只有：
     a) “格式标准化”（normalize_date）——不改变日期含义，只改变格式；
     b) “替换文本表达”（replace_text/replace_value）——但内容必须基于输入事实，不得编数字；
     c) “要求用户核对/补充”（fill_field）——此时 after 必须为 null，并明确需要补充什么。
7) 所有 *id 字段必须是 UUIDv4 字符串（小写、带连字符），包括：
   - 顶层 id
   - fixChecklist[*].id
   说明：如果输入没有提供 UUID，你必须生成新的 UUIDv4；不得使用 eval_001 / cl_xxx 这种非 UUID。

========================
二、输入：简历 JSON 字段语义说明（用于你正确理解输入）
========================
输入 JSON 的顶层字段含义如下（必须按这个语义理解简历内容）：

1) basics（基础信息）
- name: 姓名
- email / phone: 联系方式
- gender / nation / nativePlace / politicalStatus / maritalStatus: 个人信息
- birthMonth: 出生日期字符串（用于年龄/时间线判断；属于“日级”日期）
- workYears: 工作年限（如“应届/1年/3年+”）
- heightCm / weightKg: 身高体重（可忽略，不作为 ATS 重点）
- customFields: 自定义字段数组（补充信息）

2) jobIntent（求职意向：岗位匹配核心依据）
- jobIntent: 意向岗位（例：“前端”）
- intentionalCity: 意向城市
- expectedSalary: 期望薪资（数值，单位不确定；仅作参考）
- dateEntry: 到岗时间

3) applicationInfo（申请信息：不等于教育背景）
- applicationSchool / applicationMajor: 申请学校/专业
说明：这块不要当成 eduBackground。

4) eduBackground（教育背景）
- items: 教育经历数组
  - schoolName: 学校
  - professional: 专业（major）
  - degree: 学历/学位（例：硕士）
  - duration: 时间区间 [start, end]（常见 end=“至今”）
  - eduInfo: 教育描述（HTML 字符串）

5) workExperience（工作经历）
- items:
  - companyName / position
  - workDuration: 时间区间 [start, end]
  - workInfo: 工作内容描述（HTML 字符串，建议为要点列表）

6) internshipExperience（实习经历）
- items:
  - companyName / position
  - internshipDuration: 时间区间 [start, end]
  - internshipInfo: 实习内容描述（HTML）

7) campusExperience（校园经历）
- items:
  - experienceName: 经历名
  - role: 角色
  - duration: 时间区间 [start, end]
  - campusInfo: 描述（HTML）

8) projectExperience（项目经历）
- items:
  - projectName: 项目名
  - participantRole: 角色（如“独立开发”）
  - projectDuration: 时间区间 [start, end]（end 可能为空字符串）
  - projectInfo: 项目描述（HTML 字符串，可能包含背景/职责/技术/结果）

9) skillSpecialty（技能特长）
- description: 概述（HTML）
- skills: 技能数组：label / proficiencyLevel / displayType（displayType 仅影响 UI）

10) honorsCertificates（荣誉证书）
- certificates: [{name}]
- description: 描述（HTML）

11) selfEvaluation（自我评价）
- content: HTML

12) hobbies（兴趣爱好）
- hobbies: [{name}]
- description: 可为空

重要补充：
- 所有以 Info / content / description 结尾的字段大多是 HTML 字符串（富文本）。
- items 是数组，items[0] 是第一条。

========================
三、输出：AtsEvaluationResult（必须严格遵守）
========================
输出结构如下（不得增删字段）：

AtsEvaluationResult:
{
  "id": string(UUIDv4),
  "todo_items": string[],
  "created_at": string(ISO date-time),
  "resume_id": string,
  "user_id": string,
  "version": "1.0",
  "meta": {
    "document_version": number,
    "language": "zh",
    "generated_at": string(ISO date-time),
    "mode": "general_ats_check" | "optimize_resume",
    "inputDigest": string
  },
  "readabilityIndex": {
    "score": number(1-10 整数),
    "scale": { "min": 1, "max": 10 },
    "summary": string
  },
  "fixChecklist": [
    {
      "id": string(UUIDv4),
      "title": string,
      "isDone": boolean,
      "option": "required" | "optional"
    }
  ],
  "summary": {
    "overall_score": number(整数),
    "grade": string,
    "top_risks": string[3],
    "next_actions": [
      {
        "title": string,
        "locate": { "path": string, "sectionLabel": string, "fieldLabel": string, "itemLabel": string|null },
        "priority": 0|1|2
      }
    ]
  },
  "scores": {
    "job_match": { "max": 30, "score": 整数0-30 },
    "ats_parsing": { "max": 20, "score": 整数0-20 },
    "format_readability": { "max": 20, "score": 整数0-20 },
    "content_completeness": { "max": 20, "score": 整数0-20 },
    "impact_quantification": { "max": 20, "score": 整数0-20 }
  },
  "findings": {
    "high": Finding[],
    "medium": Finding[],
    "low": Finding[]
  }
}

Finding:
{
  "id": "H-001" | "M-001" | "L-001"（递增编号）,
  "type": string(snake_case),
  "title": string,
  "locate": Locate,
  "why": { "summary": string, "evidence": Evidence[] },
  "fix": { "summary": string, "steps": string[], "suggestions": Suggestion[] }
}

Locate（严格 4 字段）:
{ "path": string, "sectionLabel": string, "fieldLabel": string, "itemLabel": string|null }

Evidence:
{ "text": string, "rawValue": (string|number|boolean|null|string[]|number[]|object|object[]), "locate": Locate }

Suggestion:
{
  "kind": "replace_text" | "replace_value" | "fill_field" | "normalize_date",
  "valueType": "string" | "html_string" | "string_array" | "object_array",
  "locate": Locate,
  "before": (string|number|boolean|null|string[]|number[]|object|object[]) | null,
  "after":  (string|number|boolean|null|string[]|number[]|object|object[]) | null,
  "reason": string,
  "fixed": boolean
}

========================
四、日期标准化策略（必须遵守，不能自由发挥）
========================
- basics.birthMonth：统一为 YYYY-MM-DD（kind=normalize_date 时可用 string / 或用 replace_value 也行，但必须保持语义不变）
- 各经历区间数组字段（duration/workDuration/internshipDuration/projectDuration）：统一为 string_array:
  - start: YYYY-MM（到月即可）
  - end: "至今" 或 YYYY-MM
- 只允许“格式转换”，不允许改动日期含义与先后关系。
- 对空字符串结束时间：
  - 若能从语义判断表示“至今”，可标准化为 "至今"
  - 若无法判断，after 必须为 null 并提示用户确认

========================
五、时间线冲突（timeline_conflict）规则（必须遵守）
========================
- 仅当输入中确实存在明显冲突才产出 high finding：
  例如 birthMonth=2002-01-01，但某段经历开始时间=2002-01 或更早。
- evidence.rawValue 必须来自输入字段原始值（不得改写）。
- fix.suggestions 不得给出“猜测的新日期”：
  - kind 应为 fill_field
  - after 必须为 null
  - steps 必须明确指出需要用户核对哪些字段（出生日期/某段经历日期/年份是否误填）
  - 允许提出“常见原因”但不能写死具体日期：
    例如“可能是年份少写 20（2002 写成 2022）”，但 after 仍为 null

========================
六、建议必须具体可落地（必须遵守）
========================
1) replace_text（html_string）必须输出可直接替换的 HTML，且内容必须结合输入事实：
- eduInfo：2-4 句，覆盖【学校/专业/学位/课程方向/项目或研究/成果(占位符)】
- workInfo：必须输出 <ul>，2-4 条，每条=动作动词+技术关键词+结果/指标
  - 若输入无指标，必须用“待补充占位符”，不得编造数字
  - 示例占位符：
    “（待补充：首屏从 Xms 降到 Yms）”
    “（待补充：重复代码减少 X%）”
- projectInfo：必须按【背景/职责/技术/结果】结构输出，尽可能复用输入已有信息；
  - 结果无数据则用占位符： “（待补充：复用覆盖 X 个业务）”

2) replace_value（object_array）用于技能列表等：
- 技能必须与 jobIntent.jobIntent 匹配（如“前端”应出现 React/TS/工程化/性能/测试等）
- 不得编造自己不会的技能（只能基于输入已有技能或输入中明确声明掌握）

3) fill_field：
- 用于“缺失关键信息需要用户补充”的字段
- after 必须为 null
- reason 必须清晰说明要补什么、为什么重要

4) normalize_date：
- after 必须是 string_array（形如 ["2024-07","至今"] 或 ["2020-03","2021-08"]）
- 不得从无到有添加新的时间事实（如输入缺开始日期则 after=null）

========================
七、评分与总结生成规则（必须遵守）
========================
1) scores.max 固定：
- job_match.max=30
- 其余四项 max=20
2) scores.score 必须为整数且在范围内
3) summary.overall_score = 五项 score 之和（整数）
4) summary.top_risks 必须 3 条，来自 high/medium findings 的核心问题
5) summary.next_actions 必须 2~4 条，优先指向 high/medium 的修复动作
6) fixChecklist 生成 4~6 条：
- required 2~4 条；optional 1~2 条
- isDone：当且仅当该项对应的核心 suggestions 全部 fixed=true 才为 true，否则 false

========================
八、todo_items 生成规则（必须遵守）
========================
- 依据 top_risks + high/medium findings 归纳 3~6 个短主题词（2~6 字），不得重复
- 例：["时间线核对","日期统一","技术细节","量化成果","关键词匹配","项目亮点"]
- 不得使用空泛词（如“优化”“提升”）

========================
九、输出中的固定字段来源（必须遵守）
========================
- resume_id / user_id：必须从输入简历 JSON 中读取（若输入缺失则填空字符串 ""）
- version 固定输出 "1.0"
- created_at / meta.generated_at：使用当前时间 ISO date-time 字符串
- meta.document_version 固定 1
- meta.language 固定 "zh"
- meta.mode 默认 "general_ats_check"
- meta.inputDigest：若输入中提供则沿用，否则写 "sha256:UNKNOWN"
- 顶层 id 与 fixChecklist[*].id：必须生成 UUIDv4（小写）

========================
十、输入数据
========================
<<<RESUME_JSON>>>

========================
十一、输出要求
========================
只输出最终 AtsEvaluationResult JSON。`

export default prompt
