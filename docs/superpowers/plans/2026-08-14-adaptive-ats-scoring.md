# ATS 内容自适应评分实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 ATS 从固定模板完整度评分改造成只依据用户真实内容、由大模型综合判断适用性与证据强度的 100 分制评估，并开启思考模式。

**架构：** LLM 调用前构建只含有效内容的 `AtsAssessmentInput` 和动态定位目录；模型使用 v2 契约生成结果；客户端再按定位目录规范化分数、证据和建议。新报告把评分依据写入现有 JSONB，页面按 v2 展示，旧报告保持兼容；岗位基准工具改成不绑定模块的内容证据画像。

**技术栈：** React 19、TypeScript 5.9、Zustand、Zod 4、DeepSeek OpenAI-compatible API、Supabase JSONB、Recharts、Node TypeScript verification scripts。

---

## 文件结构

### 新建

- `src/lib/ats/types.ts`：内容自适应输入与动态定位类型。
- `src/lib/ats/constants.ts`：100 分制量表、模块与字段元数据。
- `src/lib/ats/assessment-input.ts`：生成有效内容快照和动态定位目录。
- `src/lib/ats/evidence.ts`：计算跨模块内容证据画像，供页面与 Node 验证共同复用。
- `src/lib/ats/result.ts`：校验并规范化模型结果。
- `src/lib/ats/index.ts`：ATS 内核统一导出。
- `src/pages/optimize/components/dashboard/assessment-basis-card.tsx`：展示 v2 评分依据。
- `scripts/verify-ats-adaptive-scoring.ts`：确定性场景验证。

### 修改

- `src/lib/schema/ats.ts`：增加可选 v2 元数据和评分理由。
- `src/lib/llm/prompts/optimize.ts`：改为内容自适应评分契约。
- `src/lib/llm/index.ts`：接收新输入、开启 thinking、提高预算。
- `src/pages/optimize/store.ts`：接入输入构建和结果规范化。
- `src/pages/optimize/const.ts`：更新评分名称。
- `src/pages/optimize/components/dashboard/index.tsx`：插入评分依据并修正空清单进度。
- `src/pages/optimize/components/dashboard/scores-radar-chart.tsx`：展示维度理由。
- `src/pages/optimize/components/repair-checklist/index.tsx`：更新空状态。
- `src/pages/optimize/components/analysis/finding-item.tsx`：处理无安全自动修复建议的问题。
- `src/pages/optimize/components/advanced-tools/shared/resume.ts`：增加跨模块证据统计。
- `src/pages/optimize/components/advanced-tools/shared/types.ts`：将板块数摘要改为证据数。
- `src/pages/optimize/components/advanced-tools/index.tsx`：更新摘要 badge。
- `src/pages/optimize/components/advanced-tools/benchmark/types.ts`：替换固定模块指标。
- `src/pages/optimize/components/advanced-tools/benchmark/const.ts`：改为内容证据基准。
- `src/pages/optimize/components/advanced-tools/benchmark/utils.ts`：生成内容证据报告。
- `src/pages/optimize/components/advanced-tools/benchmark/index.tsx`：更新基准展示。
- `package.json`：增加 `verify:ats`。

## 任务 1：建立有效内容输入与动态定位目录

**文件：**

- 创建：`src/lib/ats/types.ts`
- 创建：`src/lib/ats/constants.ts`
- 创建：`src/lib/ats/assessment-input.ts`
- 创建：`src/lib/ats/index.ts`
- 创建：`scripts/verify-ats-adaptive-scoring.ts`
- 修改：`package.json`

- [ ] **步骤 1：定义输入类型**

在 `src/lib/ats/types.ts` 定义：

```ts
import type { Locate, RawValue } from '../schema/ats'

export interface AtsAssessmentField {
  locate: Locate
  rawValue: RawValue
  requiredWithinEntry: boolean
}

export interface AtsAssessmentItem {
  entryId: string | null
  itemLabel: string | null
  sourceIndex: number | null
  fields: AtsAssessmentField[]
}

export interface AtsAssessmentSection {
  key: string
  label: string
  items: AtsAssessmentItem[]
}

export interface AtsAssessmentInput {
  rubricVersion: '2.0'
  sections: AtsAssessmentSection[]
  scope: {
    evaluatedSections: string[]
    ignoredEmptySections: string[]
    hasContactMethod: boolean
  }
}
```

- [ ] **步骤 2：定义唯一分值常量**

在 `src/lib/ats/constants.ts` 输出：

```ts
export const ATS_SCORE_MAX = {
  job_match: 25,
  content_completeness: 25,
  impact_quantification: 20,
  ats_parsing: 15,
  format_readability: 15,
} satisfies Record<ScoreKey, number>

export const ATS_SCORE_TOTAL = Object.values(ATS_SCORE_MAX)
  .reduce((sum, value) => sum + value, 0)
```

同文件定义模块标签、数组条目的业务字段和字段标签。数组路径使用原始索引，例如 `work_experience.items[2].workInfo`。

- [ ] **步骤 3：编写输入夹具断言**

在验证脚本构造三类简历：仅工作经历、仅项目/校园经历、第三条工作经历有效。先加入：

```ts
assert.equal(result.sections.some(section => section.key === 'project_experience'), false)
assert.equal(result.scope.ignoredEmptySections.includes('项目经历'), true)
assert.equal(result.sections.some(section => section.key === 'work_experience'), true)
assert.equal(
  flattenAssessmentFields(result)
    .some(field => field.locate.path === 'work_experience.items[2].workInfo'),
  true,
)
```

再断言已有工作条目缺少时间时仍保留空时间字段，手机号和邮箱都空时 `hasContactMethod=false`。

- [ ] **步骤 4：运行红检**

运行：`node --experimental-strip-types scripts/verify-ats-adaptive-scoring.ts`

预期：FAIL，提示无法导入 `buildAtsAssessmentInput`。

- [ ] **步骤 5：实现输入构建器**

在 `assessment-input.ts` 实现：

```ts
export function isMeaningfulAtsValue(value: unknown): boolean
export function buildAtsAssessmentInput(resume: ResumeSchema): AtsAssessmentInput
export function flattenAssessmentFields(input: AtsAssessmentInput): AtsAssessmentField[]
```

行为：全空可选模块排除；已使用数组条目保留全部核心字段和原索引；默认空条目排除；基础联系方式进入必要信号；性别、婚姻、身高、体重等不参与评分；`application_info` 不参与通用 ATS 评分。

- [ ] **步骤 6：增加统一导出和验证命令**

在 `src/lib/ats/index.ts` 导出内核；在 `package.json` 增加：

```json
"verify:ats": "node --experimental-strip-types scripts/verify-ats-adaptive-scoring.ts"
```

- [ ] **步骤 7：运行绿检**

运行：`pnpm verify:ats`

预期：输入快照与动态路径断言全部通过。

- [ ] **步骤 8：提交任务 1**

```bash
git add package.json scripts/verify-ats-adaptive-scoring.ts src/lib/ats
git commit -m "feat(ats): 构建内容自适应评估输入"
```

## 任务 2：升级类型、提示词与思考模式

**文件：**

- 修改：`src/lib/schema/ats.ts`
- 修改：`src/lib/llm/prompts/optimize.ts`
- 修改：`src/lib/llm/index.ts`
- 修改：`scripts/verify-ats-adaptive-scoring.ts`

- [ ] **步骤 1：扩展兼容性类型**

新增可选字段：

```ts
export interface AtsAssessmentMeta {
  candidateProfile: string
  inferredTarget: string
  basisSummary: string
  evaluatedSections: string[]
  evidenceSignals: string[]
}

export interface Meta {
  // 保留原字段
  rubricVersion?: '2.0' | string
  assessment?: AtsAssessmentMeta
}

export interface ScoreItem {
  score: number
  max: number
  rationale?: string
}
```

- [ ] **步骤 2：重写 v2 提示词**

`optimize.ts` 改为接收 `AtsAssessmentInput`，序列化时排除 `ignoredEmptySections`，明确：只评估 `sections`；未出现在 `sections` 的模块不得扣分或生成建议；不同经历可互相证明能力；Locate 只能来自输入；按 25/25/20/15/15 评分；风险 0–3、行动 0–4、清单 0–6；不得编造事实。

删除固定 `[0]` 白名单、固定风险数量、固定项目四段、固定技能 5–8 项、固定教育描述段数等模板诱导规则。保留 JSON、原值一致性和安全建议约束。

- [ ] **步骤 3：开启思考模式**

`runAtsStructured` 参数改为 `AtsAssessmentInput`，请求使用：

```ts
max_tokens: 16384,
thinking: { type: 'enabled' },
response_format: { type: 'json_object' },
```

系统消息保留 `ATS 简历评估引擎` 子串，使 Edge Function 继续权威识别 ATS cost。

- [ ] **步骤 4：增加契约断言**

验证脚本断言提示词包含“未出现在 sections 的模块不得扣分”，序列化输入不包含 `ignoredEmptySections`，不再包含写死的 `items[0]` 限制，并断言 `ATS_SCORE_TOTAL === 100`。

- [ ] **步骤 5：验证**

运行：`pnpm verify:ats`

运行：`pnpm exec tsc -b --pretty false`

预期：两条命令退出码均为 0。

- [ ] **步骤 6：提交任务 2**

```bash
git add scripts/verify-ats-adaptive-scoring.ts src/lib/schema/ats.ts src/lib/llm/index.ts src/lib/llm/prompts/optimize.ts
git commit -m "feat(ats): 启用思考模式与自适应评分契约"
```

## 任务 3：规范化模型结果并接入保存流程

**文件：**

- 创建：`src/lib/ats/result.ts`
- 修改：`src/lib/ats/index.ts`
- 修改：`src/pages/optimize/store.ts`
- 修改：`scripts/verify-ats-adaptive-scoring.ts`

- [ ] **步骤 1：编写结果规范化红检**

构造总分错误、max 仍为旧值、第二条经历路径有效、空项目路径无效、Evidence 原值不匹配的模型草稿，断言：

```ts
assert.equal(normalized.summary.overall_score, 82)
assert.equal(normalized.summary.grade, '优秀')
assert.equal(normalized.scores.job_match.max, 25)
assert.equal(allFindingPaths(normalized).includes('project_experience.items[0].projectInfo'), false)
assert.equal(allFindingPaths(normalized).includes('work_experience.items[1].workInfo'), true)
```

- [ ] **步骤 2：运行红检**

运行：`pnpm verify:ats`

预期：FAIL，提示 `normalizeAtsEvaluationResult` 未实现。

- [ ] **步骤 3：实现结果规范化**

在 `result.ts` 实现：

```ts
export function getAtsGrade(score: number): string
export function normalizeAtsEvaluationResult(
  draft: AtsLlmDraft,
  input: AtsAssessmentInput,
): AtsCreatePayload
```

每项 score 取有限整数并限制到量表范围，覆盖 max，根据五项和生成总分与等级。

- [ ] **步骤 4：校验路径、证据和建议**

用 `flattenAssessmentFields(input)` 建立 `Map<path, field>`。Finding、Evidence、Suggestion 必须命中目录；Evidence.rawValue 和 Suggestion.before 必须与目录值深度相等；Suggestion.after 必须非空且类型相容。移除无效证据和建议；Finding 没有合法 Evidence 时整体移除。修复清单从存活 Findings 确定性生成，避免清单重新引入空模块。

- [ ] **步骤 5：接入 Store**

`startAnalysis` 改为：

```ts
const assessmentInput = buildAtsAssessmentInput(resumeData)
const streamResult = await runAtsStructured(assessmentInput, onUpdate)
const draft = parseLlmJsonObject<AtsLlmDraft>(streamResult.content)
const payload = normalizeAtsEvaluationResult(draft, assessmentInput)
```

保留 `finishReason === 'length'` 和仅返回思考过程的错误分支。

- [ ] **步骤 6：验证**

运行：`pnpm verify:ats`

运行：`pnpm exec tsc -b --pretty false`

预期：结果规范化断言和类型检查通过。

- [ ] **步骤 7：提交任务 3**

```bash
git add scripts/verify-ats-adaptive-scoring.ts src/lib/ats src/pages/optimize/store.ts
git commit -m "feat(ats): 校验并规范化评估结果"
```

## 任务 4：展示评分依据并兼容旧报告

**文件：**

- 创建：`src/pages/optimize/components/dashboard/assessment-basis-card.tsx`
- 修改：`src/pages/optimize/const.ts`
- 修改：`src/pages/optimize/components/dashboard/index.tsx`
- 修改：`src/pages/optimize/components/dashboard/scores-radar-chart.tsx`
- 修改：`src/pages/optimize/components/repair-checklist/index.tsx`
- 修改：`src/pages/optimize/components/analysis/finding-item.tsx`

- [ ] **步骤 1：更新评分名称**

```ts
export const SCORE_LABELS = {
  job_match: '岗位定位与相关性',
  content_completeness: '内容充分度',
  impact_quantification: '成果与证据强度',
  ats_parsing: 'ATS 可解析性',
  format_readability: '表达与阅读体验',
}
```

- [ ] **步骤 2：实现评分依据卡片**

卡片从 `meta.assessment` 读取候选人画像、推断方向、综合依据、评估模块和 `scores[*].rationale`。没有 v2 字段时返回 `null`，不展示完整 reasoning。

- [ ] **步骤 3：修正零清单进度**

```ts
const progress = totalTasks === 0
  ? 100
  : Math.round((completedTasks / totalTasks) * 100)
```

零清单显示“当前未发现必须修改项”。评分依据卡片放在四个指标之后并占整行。

- [ ] **步骤 4：更新雷达图与问题入口**

雷达图继续使用 `score / max`；Tooltip 有 rationale 时显示理由。Finding 没有 suggestions 时只展示人工步骤，不渲染自动修复按钮；有 suggestions 时保持现有 IssueFix。

- [ ] **步骤 5：验证**

运行：`pnpm exec tsc -b --pretty false`

运行：`pnpm exec eslint src/pages/optimize/components/dashboard src/pages/optimize/components/repair-checklist src/pages/optimize/components/analysis/finding-item.tsx src/pages/optimize/const.ts`

预期：两条命令退出码均为 0。

- [ ] **步骤 6：提交任务 4**

```bash
git add src/pages/optimize/const.ts src/pages/optimize/components/dashboard src/pages/optimize/components/repair-checklist src/pages/optimize/components/analysis/finding-item.tsx
git commit -m "feat(ats): 展示自适应评分依据"
```

## 任务 5：将岗位基准改为内容证据画像

**文件：**

- 创建：`src/lib/ats/evidence.ts`
- 修改：`src/pages/optimize/components/advanced-tools/shared/resume.ts`
- 修改：`src/pages/optimize/components/advanced-tools/shared/types.ts`
- 修改：`src/pages/optimize/components/advanced-tools/index.tsx`
- 修改：`src/pages/optimize/components/advanced-tools/benchmark/types.ts`
- 修改：`src/pages/optimize/components/advanced-tools/benchmark/const.ts`
- 修改：`src/pages/optimize/components/advanced-tools/benchmark/utils.ts`
- 修改：`src/pages/optimize/components/advanced-tools/benchmark/index.tsx`
- 修改：`scripts/verify-ats-adaptive-scoring.ts`

- [ ] **步骤 1：定义跨模块证据统计**

在 `src/lib/ats/evidence.ts` 中定义：

```ts
export interface ResumeEvidenceStats {
  evidenceCount: number
  substantiveRatio: number
  impactEvidenceRatio: number
  positioningConsistency: number
}

export function getResumeEvidenceStats(resume: ResumeSchema): ResumeEvidenceStats
```

证据数量聚合教育、工作、实习、校园和项目有效条目；实质描述比例统计包含具体职责/范围的条目；成果比例识别结果、交付、范围、数据等证据；定位一致性比较求职意向、岗位名称、项目角色和技能关键词，不依赖某个模块存在。

`src/pages/optimize/components/advanced-tools/shared/resume.ts` 只调用该纯函数并组装页面摘要，避免 Node 验证脚本导入带 `@/` 别名和浏览器依赖的页面模块。

- [ ] **步骤 2：添加无模板配额断言**

验证工作证据充分而项目、证书、自评为空时，报告中不存在 `project`、`certificates`、`selfEvaluation`、`filledSections` 指标，也没有要求补齐这些模块的文案。

- [ ] **步骤 3：替换目标类型和报告**

`BenchmarkTargets` 只保留：

```ts
export interface BenchmarkTargets {
  evidenceCount: number
  substantiveRatio: number
  impactEvidenceRatio: number
  positioningConsistency: number
  atsScore: number | null
}
```

报告输出有效能力证据、有实质描述的经历、成果或影响证据、内容定位一致性、ATS 总分。推荐语只描述证据薄弱、表达空泛、结果支撑不足或定位分散。

- [ ] **步骤 4：更新 UI 和摘要**

`ResumeToolSummary.sectionCount` 改为 `evidenceCount`；Drawer badge 改成“有效证据 X 条”；基准页增加“不直接参与 ATS 总分”；删除固定模块 icon 和补齐模块文案。

- [ ] **步骤 5：验证**

运行：`pnpm verify:ats`

运行：`pnpm exec tsc -b --pretty false`

运行：`pnpm exec eslint src/pages/optimize/components/advanced-tools`

预期：全部退出码为 0。

- [ ] **步骤 6：提交任务 5**

```bash
git add scripts/verify-ats-adaptive-scoring.ts src/pages/optimize/components/advanced-tools
git commit -m "refactor(ats): 移除固定模块基准"
```

## 任务 6：完整验证与交付审计

**文件：**

- 检查：本计划列出的全部实现文件。
- 修改：`scripts/verify-ats-adaptive-scoring.ts`（仅在审计发现覆盖缺口时）。

- [ ] **步骤 1：运行专项验证**

运行：`pnpm verify:ats`

预期明确通过：空模块中性、跨模块替代、稀疏内容低分、条目内部缺失、多条目定位、虚构证据过滤、100 分制、旧报告兼容、基准无模块配额。

- [ ] **步骤 2：运行 TypeScript 与 lint**

运行：`pnpm exec tsc -b --pretty false`

运行：`pnpm exec eslint src/lib/ats src/lib/schema/ats.ts src/lib/llm/index.ts src/lib/llm/prompts/optimize.ts src/pages/optimize scripts/verify-ats-adaptive-scoring.ts`

预期：退出码均为 0。

- [ ] **步骤 3：运行生产构建**

运行：`pnpm build`

预期：Vite production build 成功。已有体积 warning 可以记录，不得出现构建失败。

- [ ] **步骤 4：检查差异**

运行：`git diff --check`

运行：`git status --short`

运行：`rg -n "filledSectionCount|thinking: \{ type: 'disabled' \}|items\[0\].*只能" src/lib/ats src/lib/llm src/pages/optimize`

预期：没有空白错误；状态中只有本任务和用户已有改动；ATS 路径中无固定板块计数、关闭思考模式或写死第一条的限制。

- [ ] **步骤 5：记录验证边界**

若未消耗用户线上 LLM 额度执行真实请求，交付说明必须区分：专项夹具、类型、lint、构建已经验证；真实 DeepSeek 输出稳定性仍需登录态手动发起一次 ATS 分析确认。

## 自检结果

- 输入清洗、跨模块证据、100 分制、thinking、动态定位、结果校验、透明展示、旧数据兼容和基准迁移均有对应任务。
- 不依赖数据库表变更；新字段进入现有 JSONB。
- 类型名统一使用 `AtsAssessmentInput`、`AtsAssessmentMeta`、`ATS_SCORE_MAX`、`buildAtsAssessmentInput` 和 `normalizeAtsEvaluationResult`。
- 线上 LLM 验证与本地确定性验证已明确区分。
