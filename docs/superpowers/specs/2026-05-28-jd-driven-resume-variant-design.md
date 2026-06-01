# JD 驱动的针对性简历变体 — 设计文档

- 状态：Draft（待用户审阅）
- 起草日期：2026-05-28
- 关联模块：`src/components/jd-variant/`、`src/lib/llm/`、`src/lib/supabase/resume/`、`src/lib/offline-resume-manager.ts`、`src/pages/resume/`、`src/pages/resume/editor/`、`src/pages/optimize/components/advanced-tools/job-description/`

---

## §1 范围与目标

### 1.1 功能定义

**JD 驱动的针对性简历变体**：用户在简历列表卡片菜单或 Optimize JD 比对页触发「为 JD 派生变体」，粘贴 JD 文本后，系统自动复制源简历并由 LLM 按 JD 智能局部改写，产出一份独立的、保留事实型字段、定向优化文案型字段的"变体简历"，并完整管理变体与源简历的双向血缘关系（含可视化血缘树）。

### 1.2 核心成功指标（DoD）

- 用户在 ≤ 3 步操作内完成"粘贴 JD → 拿到变体"
- 变体生成全过程 ≤ 90s（解析 JD + 改写 + 落库），失败可一键重试
- 变体与源简历血缘双向可见、可跳转，可可视化树
- 变体的事实型字段（姓名/学校/时间/证书/外观）100% 与源简历一致，不被 LLM 改动
- 任意阶段中断（关闭 Dialog / 网络断 / 报错）不留垃圾数据，可恢复或一键丢弃

### 1.3 显式不做

- 不做基于 JD 的 cover letter 生成（属于 P0 #3）
- 不做 ATS 解析模拟（属于 P0 #4）
- 不做"先选模板再派生"——派生只继承源简历的当前外观/模板
- 不做多 JD 批量派生（一次一份）
- 不做血缘树的拖拽编辑——只读展示

### 1.4 用户场景

1. **快速派生**：阿明在简历列表看到「我的简历 v1」卡片，菜单点「为 JD 派生变体」→ 粘贴腾讯前端 JD → 90s 后获得「我的简历 v1（腾讯前端版）」并自动跳转到编辑器。
2. **先比对再派生**：阿玲在 Optimize 页 JD 比对工具粘贴字节 JD → 看到匹配度 65%、缺失关键词 → 点底部「基于此 JD 派生新简历」按钮 → 弹出预填了 JD 的 Dialog → 直接生成变体。
3. **管理多变体**：阿强对一份原始简历派生了 5 份变体（腾讯/字节/美团/阿里/快手），在原简历的「血缘树」按钮里看到树状视图，可一键跳转任意变体。
4. **变体再派生**：阿强觉得腾讯版很棒，想基于它再派生一份"腾讯前端 - 资深岗"——支持，二级派生在血缘树中显示为子节点。

### 1.5 可改写字段白名单

- `basics.summary`（个人简介）
- `job_intent`（求职意向）
- `skill_specialty`（技能专长）
- `self_evaluation`（自我评价）
- `work_experience.*.bullets / work_experience.*.description`
- `internship_experience.*.bullets / internship_experience.*.description`
- `project_experience.*.description / project_experience.*.techStack`
- `campus_experience.*.description`

### 1.6 绝对禁止改写的字段

- `basics.name / basics.phone / basics.email / basics.gender / basics.birthday / basics.location / basics.avatar`
- `edu_background`（学校、专业、时间、绩点）
- `honors_certificates`（证书）
- `application_info`（求职元信息）
- 外观配置（spacing / font / theme）、order、visibility、templateBinding
- 任意时间、公司名、学校名、岗位 title、项目 title

---

## §2 架构与目录结构

### 2.1 整体分层

```
入口层（UI Triggers）
├─ ResumeCard 菜单 → 「为 JD 派生变体」
└─ Optimize JD 比对结果区底部 → 「基于此 JD 派生新简历」
            ↓
Dialog 层（统一派生流程）
JdVariantDialog
├─ Step 1 输入 JD（textarea, ≥ 30 字）
├─ Step 2 解析 JD（流式关键词 chips + reasoning）
├─ Step 3 改写中（按字段进度条 + reasoning + 流式 changes）
└─ Step 4 完成（修改摘要 + 跳转/重试/丢弃）
            ↓
调度 hook 层（jd-variant 模块内）
useJdVariantGenerator
├─ Phase 1: parseJobDescription() → keywords[]
├─ Phase 2: createDraftVariant() → 在 Supabase / IDB 创建草稿
├─ Phase 3: streamRewrite() → 流式生成 changes[]
├─ Phase 4: applyChanges() → 写入草稿 → 标记 ready
└─ AbortController + 失败回滚 + 重试
            ↓
能力层
├─ src/lib/llm/index.ts + runJdVariantParse / runJdVariantRewrite
├─ src/lib/llm/prompts/jd-variant.ts（新）
├─ src/lib/supabase/resume/variant.ts（新）
│  ├─ cloneResumeAsDraft / applyVariantChanges
│  ├─ markVariantReady / markVariantFailed
│  ├─ deleteDraftVariant / fetchVariantTree
└─ src/lib/offline-resume-manager.ts 扩展同名能力（DB v2 迁移）
            ↓
数据层
Supabase resume_config 表 +4 列：
├─ parent_resume_id   uuid, ref resume_config(id) ON DELETE SET NULL
├─ linked_jd_text     text
├─ derived_metadata   jsonb { keywords, changes, generatedAt, matchRate }
└─ derived_status     text 'generating' | 'ready' | 'failed'
IndexedDB v2 同步加这 4 个字段到 resumes store
```

### 2.2 目录结构

```
src/
├─ components/
│  └─ jd-variant/                          # 新增模块（与 ai-rewrite 同级）
│     ├─ index.ts                          # barrel
│     ├─ jd-variant-dialog.tsx             # 派生 Dialog（4 步骤切换）
│     ├─ jd-variant-trigger-menu-item.tsx  # 复用：列表 + optimize 共用触发器
│     ├─ steps/
│     │  ├─ step-input.tsx                 # Step 1: JD textarea + 验证
│     │  ├─ step-parsing.tsx               # Step 2: 关键词流 + reasoning
│     │  ├─ step-rewriting.tsx             # Step 3: 字段进度条 + reasoning
│     │  └─ step-result.tsx                # Step 4: 修改摘要 + 操作
│     ├─ variant-lineage-popover.tsx       # 编辑器 toolbar 用
│     ├─ variant-lineage-tree-dialog.tsx   # 血缘树 Dialog
│     ├─ variant-lineage-tree.tsx          # 树渲染组件（递归）
│     ├─ use-jd-variant-generator.ts       # 主调度 hook
│     ├─ use-variant-lineage.ts            # 拉取血缘树 + 缓存
│     ├─ parse-variant-response.ts         # 容错解析 changes
│     ├─ apply-changes.ts                  # changes → snapshot 应用
│     ├─ const.ts                          # 阈值/字段白名单/枚举/MESSAGES
│     ├─ types.ts                          # 全部类型
│     └─ utils.ts                          # buildEditableView / matchRate 等
│
├─ lib/
│  ├─ llm/
│  │  ├─ index.ts                          # +runJdVariantParse / runJdVariantRewrite
│  │  └─ prompts/
│  │     └─ jd-variant.ts                  # 新：JD 派生 prompt
│  ├─ supabase/resume/
│  │  ├─ variant.ts                        # 新：派生专用查询/变更
│  │  ├─ form.ts                           # 微调：getResumeById 包含新列
│  │  └─ types.ts                          # 加 4 个字段到 PersistedResumeRow
│  └─ offline-resume-manager.ts            # DB_VERSION 1→2
│
├─ lib/schema/resume/
│  ├─ persisted.ts                         # PersistedResumeSnapshot +variant 块
│  └─ variant/                             # 新子目录
│     ├─ index.ts                          # 导出 VariantMetadata schema
│     └─ types.ts                          # VariantChange / DerivedStatus
│
├─ store/resume/
│  └─ form.ts                              # 透传 variant metadata 到 store
│
├─ pages/
│  ├─ resume/
│  │  ├─ index.tsx                         # 列表页 +Filter Tabs
│  │  ├─ store/
│  │  │  └─ resume-list.ts                 # +filter state + selectors
│  │  ├─ const.ts                          # +VARIANT_FILTER 枚举
│  │  └─ components/
│  │     ├─ resume-card/
│  │     │  ├─ index.tsx                   # +变体徽章 + 派生菜单 + 派生数角标
│  │     │  └─ variant-badge.tsx           # 新组件
│  │     └─ derived-jobs-dialog/
│  │        └─ index.tsx                   # 派生中/失败简历管理
│  ├─ resume/editor/components/
│  │  └─ toolbar/
│  │     └─ variant-lineage-button.tsx     # 新：唤起 popover/tree dialog
│  └─ optimize/components/advanced-tools/
│     └─ job-description/
│        ├─ index.tsx                      # +底部 actions「派生为新简历」
│        └─ jd-derive-button.tsx           # 新：调用 JdVariantDialog（预填 JD）
│
└─ docs/superpowers/
   ├─ specs/2026-05-28-jd-driven-resume-variant-design.md
   └─ plans/2026-05-28-jd-driven-resume-variant.md
```

### 2.3 命名约定

- 模块根目录：`src/components/jd-variant/`（kebab-case 与 ai-rewrite 一致）
- 组件文件：folder-based 仅用于复杂组件（如 `steps/`），简单组件平铺
- hook 文件：`use-*.ts`
- 常量：`const.ts`，类型：`types.ts`，纯函数：`utils.ts`
- Schema：放在 `lib/schema/resume/variant/`，与现有 `visibility/`、`config/` 同级

### 2.4 关键设计原则

1. **复用 ai-rewrite 心智模型**：Dialog 流程 / 调度 hook / parse-response / 错误恢复 完全一致的代码风格，降低维护成本
2. **Variant 模块自治**：所有变体相关 UI / 逻辑 / 类型 收敛在 `components/jd-variant/`，列表页/编辑器/optimize 仅需挂入口
3. **数据层向后兼容**：所有新增列均 nullable + 默认值，老简历 `parent_resume_id=null` 即"原始简历"
4. **草稿机制天然防垃圾**：派生失败/中断时 `derived_status='failed' | 'generating'` 的简历列表页默认过滤；用户可在「失败的派生」分组里看到并清理
5. **共用 JD store**：派生用的 JD 文本与现有 `optimize-job-description-tool-storage` 共用同一个 key（如果用户在 Optimize 页输过 JD，列表页触发派生时自动预填）

---

## §3 数据流与类型契约

### 3.1 核心类型

```ts
// ─── 持久化层（Supabase + IndexedDB 共用） ──────────────────────
export type DerivedStatus = 'generating' | 'ready' | 'failed'

export interface VariantChange {
  /** 命中的 12 个 section 之一（与 ResumeSchema 顶级 key 一致） */
  section: keyof ResumeSchema
  /** 子项 id；若整段（如 self_evaluation）则为 'whole' */
  itemId: string | 'whole'
  /** 字段路径，如 'description'、'bullets'、'summary' */
  fieldPath: string
  /** 改写前后内容（HTML 或纯文本） */
  before: string
  after: string
  /** 该次改写命中的 JD 关键词 */
  matchedKeywords: string[]
  /** LLM 给出的改写理由（≤ 60 字） */
  reason: string
}

export interface VariantMetadata {
  /** JD 关键词（解析阶段产出） */
  keywords: string[]
  /** 改写记录列表（改写阶段产出） */
  changes: VariantChange[]
  /** 完成时间 ISO 8601 */
  generatedAt: string
  /** 关键词与简历交集占比 0-1 */
  matchRate: number
}

// 写入 Supabase resume_config 表的 4 个新列
export interface VariantPersistedFields {
  parent_resume_id: string | null
  linked_jd_text: string | null
  derived_metadata: VariantMetadata | null
  derived_status: DerivedStatus | null  // null = 原始简历
}

// ─── 调度层（hook 与 UI 共用） ──────────────────────────────────
export type GeneratorPhase =
  | 'idle'
  | 'parsing'      // Phase 1: 解析 JD
  | 'rewriting'    // Phase 2: 改写中（流式）
  | 'success'      // Phase 4: 完成
  | 'error'        // 任意阶段失败
  | 'aborted'      // 用户取消

export interface VariantAnalysisLog {
  id: string
  timestamp: string
  level: 'info' | 'warn' | 'error'
  message: string
}

export interface GeneratorState {
  phase: GeneratorPhase
  draftResumeId: string | null
  keywords: string[]
  changes: VariantChange[]
  completedSections: Array<keyof ResumeSchema>
  errorMessage: string | null
  matchRate: number
  /** 解析阶段思考链（实时累积） */
  parseReasoning: string
  /** 改写阶段思考链（实时累积） */
  rewriteReasoning: string
  /** 流式累积的 raw content（用于 UI 透明展示） */
  rewriteContent: string
  /** 当前阶段日志 */
  logs: VariantAnalysisLog[]
}

export interface GenerateVariantArgs {
  parentResumeId: string
  jdText: string
  reuseKeywords?: string[]   // 重试时复用上次解析结果
}

// ─── 血缘树 ────────────────────────────────────────────────────
export interface VariantTreeNode {
  resumeId: string
  displayName: string
  derivedStatus: DerivedStatus | null
  generatedAt: string | null
  jdSnippet: string | null
  matchRate: number | null
  children: VariantTreeNode[]
}

export interface VariantLineage {
  root: VariantTreeNode
  currentId: string
}

// ─── 列表过滤 ───────────────────────────────────────────────────
export type ResumeFilterMode = 'all' | 'originals' | 'variants'
```

### 3.2 派生流程（4 阶段）

```
User: 点击「为 JD 派生变体」 + 粘贴 JD + 点提交
            ↓
Phase 1: parseJobDescription()
├─ runJdVariantParse({ jdText })
├─ LLM 流式输出 { keywords, summary }
├─ UI: 关键词 chips 渐显 + reasoning 实时滚动
└─ 阈值：keywords.length ∈ [3, 30]，否则视为解析失败
            ↓
立刻创建草稿（不走 LLM）
├─ cloneResumeAsDraft(parentResumeId, jdText, keywords)
├─ 复制 parent 的 PersistedResumeSnapshot
├─ 写入 resume_config { parent_resume_id, linked_jd_text,
│       derived_status: 'generating',
│       derived_metadata: { keywords, changes: [] } }
├─ display_name = `${parent.display_name} - ${顶部关键词}`
└─ 返回 draftResumeId
            ↓
Phase 2: streamRewrite()
├─ runJdVariantRewrite({ resumeJson: filterEditableSections(parent),
│                        jdText, keywords })
├─ LLM 流式输出 { changes: VariantChange[] } + reasoning
├─ 每收到一个 change: applyChangeToDraft(draftResumeId, change)
├─ UI: completedSections 累加 → 进度条 + reasoning 滚动
└─ 校验：仅白名单字段；非白名单 section 的 change 直接丢弃
            ↓
Phase 3: 收尾
├─ 计算 matchRate = ∩(keywords, finalResume) / keywords.length
├─ markVariantReady(draftResumeId, { matchRate, generatedAt })
├─ derived_status: 'generating' → 'ready'
└─ 列表页 Realtime 自动收到更新
            ↓
Phase 4: 完成态 UI
├─ 显示「修改了 N 处」+ 折叠摘要 + 匹配率
└─ Actions: [打开变体] / [再生成一次] / [丢弃]

✗ 任意阶段错误：
├─ Phase 1 失败 → 不创建草稿，直接错误态（无清理）
├─ Phase 2 失败 → markVariantFailed(draftResumeId, errMsg)
│                  derived_status: 'generating' → 'failed'
└─ 列表页过滤 'failed' 默认隐藏，可在「失败的派生」分组查看 + 清理

⊗ 用户取消（关闭 Dialog 或 Esc）：
├─ AbortController.abort() 中断流
├─ 二次确认对话框：「派生中，确认放弃？」
└─ 确认 → deleteDraftVariant(draftResumeId) → 列表页移除
```

### 3.3 LLM 契约

#### Phase 1 输出（解析 JD）

```json
{
  "keywords": ["React", "TypeScript", "微前端", "qiankun", "性能优化"],
  "summary": "字节前端 - 资深岗，强调微前端架构经验"
}
```

- `keywords`：3 ≤ length ≤ 30，去重后存入 metadata
- `summary`：用于生成变体名（不存库，仅 UI 展示）

#### Phase 2 输出（改写）

```json
{
  "changes": [
    {
      "section": "self_evaluation",
      "itemId": "whole",
      "fieldPath": "content",
      "before": "<p>...</p>",
      "after": "<p>...</p>",
      "matchedKeywords": ["React", "性能优化"],
      "reason": "突出 React 与性能优化经验，贴合 JD 关键词"
    }
  ]
}
```

**LLM 硬约束（在 prompt 内强制）**：

- `section` ∈ 白名单（§1.5）
- `itemId` 必须存在于 `resumeJson` 中（不许伪造）
- `before` 必须与原数据一致（用于服务端二次校验，不一致直接丢弃该 change）
- `after` ≠ `before`，且 `length(after) ≤ length(before) * 1.5`（防止失控膨胀）
- 总 changes 数：3 ≤ N ≤ 15

#### 容错解析（`parse-variant-response.ts`）

- 流式 partial JSON 用 `parseLlmJsonObject` 容错（已有）
- 每条 change 单独校验：失败丢弃（不让一条坏数据毁掉整批）
- 改写完成后若有效 changes < 3 → 抛错 "AI 改写无效，请重试"

### 3.4 血缘树拉取

```
编辑器 toolbar variant-lineage-button 点击
        ↓
useVariantLineage(currentResumeId)
        ↓
fetchVariantTree(currentResumeId):
├─ 1. 向上找 root：顺着 parent_resume_id 链查到 parent_resume_id IS NULL
├─ 2. 从 root 向下 BFS 一次查询：
│     SELECT * FROM resume_config WHERE parent_resume_id = ANY(node_ids)
├─ 3. 在内存里拼成树（最多 3 层 BFS = 4 次 DB 查询，可接受）
└─ 4. 缓存到 Zustand 全局 store（key=rootId），同 root 下任意节点共享
        ↓
返回 { root, currentId }
        ↓
VariantLineageTree 递归渲染：
├─ 节点：[徽章] 名称 / matchRate / generatedAt
├─ 当前节点高亮 + 黄色描边
├─ 点击非当前节点 → setCurrentResume + navigate('/resume/editor')
└─ 默认折叠到深度 2，可展开
```

### 3.5 列表页过滤数据流

```
useResumeListStore.filterMode: 'all' | 'originals' | 'variants'
        ↓
selectFilteredResumes(state):
- 'all'        → resumes（保留 derived_status: 'ready' | null，过滤 generating/failed）
- 'originals'  → resumes.filter(r => r.parent_resume_id === null)
- 'variants'   → resumes.filter(r => r.parent_resume_id !== null && r.derived_status === 'ready')
        ↓
列表页 grid 渲染
        ↓
另设独立 Section「派生中 / 失败的派生」（仅 derived_status='generating'|'failed'）
```

### 3.6 写入路径选择

| 用户登录态 | parent 是 | 派生路径 |
|---|---|---|
| 已登录 | 云端简历 | Supabase（cloneResumeAsDraft → applyChanges → markReady） |
| 已登录 | 离线简历（local-xxx） | Supabase（先把 parent 上传到云，再派生），并提示用户 |
| 未登录 | 任意 | IndexedDB（offline-resume-manager 全套同名能力） |

未登录用户也支持派生：用 `local-` 前缀 id，IndexedDB v2 加 4 字段；体验完全一致。

---

## §4 Prompt 设计

### 4.1 设计原则

- **两阶段独立调用**：解析与改写分开，单次输出 token 更少 → 更快、更稳；解析失败时不浪费改写预算
- **强约束输出协议**：与 ai-rewrite `runBulletRewrite` 同样的"只输出 JSON / 不要解释 / 字段缺一不可"硬规则
- **白名单驱动改写**：prompt 中显式列出可改字段、显式禁止伪造身份事实，把幻觉风险压到最低
- **温度选择**：解析阶段 `0.2`（高确定性）、改写阶段 `0.6`（与 ai-rewrite 一致）

### 4.2 文件位置

`src/lib/llm/prompts/jd-variant.ts`：

```ts
export function buildJdParsePrompt(jdText: string): { system: string; user: string }
export function buildJdRewritePrompt(args: {
  resumeJson: EditableResumeView
  jdText: string
  keywords: string[]
}): { system: string; user: string }
```

`EditableResumeView`（`src/components/jd-variant/utils.ts` 提供 `buildEditableView(resume)`）：从 PersistedResumeSnapshot 抽取白名单字段并保留 `id` 路径，扔掉 LLM 不需要看的元数据。

### 4.3 Phase 1：JD 解析 prompt

**System**：

```
你是资深 HR / 求职顾问，擅长从岗位描述（JD）中提炼关键词。
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
}
```

**User**：`JD 文本如下：\n"""\n${jdText}\n"""\n\n请只输出 JSON 对象。`

**温度**：0.2

### 4.4 Phase 2：JD 改写 prompt

**System**（节选关键约束）：

```
你是资深简历优化顾问，擅长把现有简历针对特定岗位做"局部精修"。

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
  "before": "...", "after": "...", "matchedKeywords": ["..."], "reason": "..." }] }
```

**温度**：0.6

### 4.5 Edge Cases

| 场景 | prompt 处理 |
|---|---|
| JD 太短（< 30 字） | Dialog 校验，不调 LLM |
| 简历某 section 为空 | resumeJson 不传该 section |
| JD 与简历完全无关 | LLM 仍会改写自我评价/求职意向；matchRate 较低，UI 提示「匹配度低」 |
| LLM 输出非 JSON / 截断 | `parseLlmJsonObject` 容错；失败 → markVariantFailed |
| LLM 输出 before 与原文不一致 | `parse-variant-response.ts` 校验丢弃该条 |
| LLM 改写身份事实 | 白名单已禁止；服务端 fallback：黑名单 section 的 change 全部丢弃 |

### 4.6 LLM 入口扩展

`src/lib/llm/index.ts` 新增：

```ts
export async function runJdVariantParse(
  jdText: string,
  onUpdate: StreamUpdateHandler<{ keywords: string[]; summary?: string }>,
  options?: { abortController?: AbortController },
): Promise<{ keywords: string[]; summary?: string }>

export async function runJdVariantRewrite(
  args: { resumeJson: EditableResumeView; jdText: string; keywords: string[] },
  onUpdate: StreamUpdateHandler<{ changes: VariantChange[] }>,
  options?: { abortController?: AbortController },
): Promise<{ changes: VariantChange[] }>
```

两者均复用 `streamStructuredJson` + `parseLlmJsonObject`，与 `runBulletRewrite` 同构。

### 4.7 Token 预算

- Phase 1：JD 平均 800 字 → input 1k token，output ~200 token，~3s
- Phase 2：filtered resumeJson 4k + JD 1k + keywords 100 → input 5k token，output ~3k token（changes 平均 8 条），~30~60s

总耗时 **35~75s**，落在 §1.2 的 ≤ 90s 目标内。

### 4.8 思考过程（reasoning）实时展示

#### LLM 层

`streamStructuredJson` 的 `onUpdate` 回调签名是 `({ content, reasoning })`，DeepSeek 推理模型同时流出 `reasoning_content`（思考链）和 `content`（最终 JSON）。新加的两个入口直接复用此机制，与 `runAtsStructured` 完全同构。

#### 调度 hook 层（`useJdVariantGenerator`）

`GeneratorState` 已扩展 `parseReasoning / rewriteReasoning / rewriteContent / logs` 4 个字段（见 §3.1）。

```ts
await runJdVariantParse(jdText, ({ content, reasoning }) => {
  setState(s => ({ ...s, parseReasoning: reasoning }))
}, { abortController })
```

#### UI 层（Step 2 / Step 3）

复用项目内已有的 `ChainOfThought` + `AutoScrollContainer`，结构与 `AnalysisTrace` 完全一致：

```
[ChainOfThoughtHeader]  📊 分析链路（点击展开/折叠）
[ChainOfThoughtContent]
├─ Step "解析 JD"        ✓ done    keywords[] chips
├─ Step "模型正在思考"     ⟳ active  ← reasoning 实时滚动展示
├─ Step "改写中"          ⟳ active  completedSections / N 段已完成
└─ Step "校验输出"        ⏳ pending
```

#### 步骤定义

`src/components/jd-variant/const.ts` 中的 `JD_VARIANT_STEPS`：

```ts
export const JD_VARIANT_STEPS: VariantStepConfig[] = [
  { id: 'parsing', label: '解析 JD 关键词', icon: ScanText },
  { id: 'thinking', label: '模型正在思考', icon: Brain },
  { id: 'cloning', label: '复制源简历草稿', icon: Copy },
  { id: 'rewriting', label: '改写候选字段', icon: Wand2 },
  { id: 'validating', label: '校验输出与匹配率', icon: ShieldCheck },
  { id: 'done', label: '完成', icon: CheckCircle2 },
]
```

#### 错误态保留 reasoning

LLM 报错时 `reasoning` 不丢弃 — 错误态 Dialog 底部仍可展开"分析链路"，便于用户判断问题来源。

---

## §5 UI 与交互细节

### 5.1 整体设计原则

- **风格 100% 与项目内现有 Dialog 对齐**：使用 `ResponsiveDialog`、`Card`、`Alert`、`Tabs`、`Popover`、`Badge`、`Button`、`ChainOfThought`、`AutoScrollContainer`
- **图标统一使用 lucide-react**：`Target / Sparkles / Wand2 / Brain / ScanText / Copy / ShieldCheck / CheckCircle2 / RotateCw / Trash2 / GitBranch / ExternalLink`
- **桌面/移动自适应**：所有 Dialog 走 `ResponsiveDialog`
- **a11y**：所有按钮 `onMouseDown e.preventDefault()`（避免 Radix `aria-hidden` 警告）

### 5.2 入口 1：简历卡片菜单

`src/pages/resume/components/resume-card/index.tsx` 现有 DropdownMenu 加项：

```
ResumeCard 右上角 ⋮ 菜单
├─ 编辑信息（已有）
├─ 为 JD 派生变体  ← 新增（带 Target 图标）
├─ 查看血缘树     ← 新增（仅当有 parent 或 children 时）
└─ 删除（已有）
```

**变体卡片视觉差异**：

- 卡片右上角 `Badge`：`<Target /> JD 变体`
- 卡片底部追加：`派生自《XX》` → 点击跳转到源简历
- 原始简历有 ≥1 个变体：右上角 Badge `<GitBranch /> N 个变体`（点击打开血缘树 Dialog）

**派生中 / 失败的简历独立分组**：

- 列表页 grid 上方 `Alert` 卡片：`「派生中 (2)」/「失败的派生 (1)」`
- 「查看」打开 `DerivedJobsDialog` 列出 generating/failed 简历，每行可「重试 / 丢弃」

### 5.3 入口 2：Optimize 页 JD 比对底部

`job-description/index.tsx` 比对结果区底部 sticky footer 加按钮：

```
[基于此 JD 派生新简历]  ← 主按钮，仅 JD 文本 ≥ 30 字时启用
```

点击 → 唤起 `JdVariantDialog`，**预填**当前 JD 文本与目标简历 id（来自 `useCurrentResumeStore`），用户直接进入 Step 2，跳过 Step 1。

### 5.4 主流程 Dialog `JdVariantDialog`

#### 容器

- 复用 ai-rewrite 验证过的尺寸：`sm:h-[85vh] sm:max-h-[85vh] sm:max-w-3xl flex flex-col gap-0 overflow-hidden p-0`
- Header 固定，content 区 `flex-1 min-h-0 overflow-y-auto`，Footer 固定

#### 4 个步骤

```
DialogHeader：[Target 图标] 为「我的简历 v1」派生 JD 变体
副标题：在原简历基础上，AI 会针对 JD 局部改写文案，事实型字段保持不变。

[Step 1: 输入 JD]   [Step 2: 解析]   [Step 3: 改写]   [Step 4: 完成]
   ●───────────────────○───────────────────○───────────────────○
   ↑ 步骤指示器（横向 4 个圆点 + label）
```

##### Step 1：输入 JD

- 大 Textarea（≥ 12 行）+ 字符计数 `30 / 至少 30 字`
- 下方 Tip：示例 JD 折叠 Accordion
- 如果用户曾在 optimize 页输过 JD：右上角 chip `↻ 复用上次 JD（前 30 字...）`
- Footer：`取消` + `生成变体`（disabled until ≥ 30 字）

##### Step 2：解析 JD（流式）

- 顶部进度条 `[●●○○]`
- 左侧主区：`ChainOfThought` 折叠面板
  - Step `解析 JD 关键词` —— active，已收 keywords 流式追加为 chip
  - Step `模型正在思考` —— active，下方 `AutoScrollContainer` 滚动展示 reasoning
- 右侧侧栏：实时 keywords chips 网格 + 一句岗位画像
- Footer：`Esc 取消` 提示 + `取消` 按钮

##### Step 3：改写中（流式）

- 进度条 `[●●●○]`
- 主区 ChainOfThought：
  - `复制源简历草稿` ✓
  - `改写候选字段` —— active，下方进度细节：
    - 已完成 / 总字段：`3 / 8 段已改写`
    - 当前正在改写的 section badge 滚动闪烁
    - `AutoScrollContainer` 滚动展示 `rewriteReasoning`
  - `校验输出与匹配率` —— pending
- 右侧侧栏：已完成的 changes 卡片列表（每条卡片顶部高亮闪现）
  - card 结构：`[section badge] [matchedKeywords chips] [reason] [view diff 链接]`
- Footer：`关闭` 弹二次确认 → `保留草稿稍后重试 / 丢弃` 双选

##### Step 4：完成

- 进度条 `[●●●●]`
- 主区顶部 `Alert variant="default"`：
  - `<CheckCircle2 className="text-green-600" />` `变体生成完成`
  - `修改了 N 处 / 共 M 段 / 命中 K 个关键词 / 匹配率 78%`
- 主体：可折叠的「修改摘要」`Accordion` 列表
  - 每条 = section / matched keywords / before vs after
- Footer 三按钮：
  - `打开变体`（主按钮，→ `setCurrentResume(draftId)` + `navigate('/resume/editor')`）
  - `再生成一次`（→ 复用 keywords，跳到 Step 3）
  - `丢弃`（二次确认 → `deleteDraftVariant`）

##### 错误态

- Alert variant="destructive" + AlertCircle
- 错误原因
- ChainOfThought 仍可展开（保留 reasoning 上下文）
- Footer：`重试`（保留草稿仅重跑当前阶段）+ `丢弃` + `复制错误信息`

##### 取消态

- 派生中关闭 → AlertDialog 二次确认
- 标题：`派生中，确认放弃？`
- 描述：`已生成 N 处改写。放弃将删除草稿简历。`
- 按钮：`继续派生 / 保留草稿稍后重试 / 丢弃草稿`

### 5.5 编辑器 toolbar 入口：variant-lineage-button

挂在简历编辑器顶部 toolbar：

```
[ <Target /> 变体信息 ]  ← 仅当 parent_resume_id 非 null 或 has children 时显示
       ↓ 点击
┌────────────────────────────────────────────┐
│ [Popover, w-96]                            │
│ 当前简历是「我的简历 v1」的 JD 变体          │
│ 派生时间：2026-05-28 14:30                  │
│ 匹配率：78% (12/15 关键词)                   │
│                                            │
│ JD 原文（折叠 200 字 / 全文展开）             │
│ [展开全部] [复制 JD]                          │
│                                            │
│ 修改摘要 N 处                                 │
│ - 自我评价  ✏️  React, 性能优化              │
│ - 工作经历1 ✏️  微前端                        │
│ [查看完整 diff]                              │
│                                            │
│ ─────────────────                          │
│ [跳转到源简历 →]   [查看血缘树 ⇲]            │
└────────────────────────────────────────────┘
```

源简历方向：当此简历 has children 时按钮文案变 `<GitBranch /> N 个变体`，Popover 显示子变体列表 + 跳转 + 查看血缘树。

### 5.6 血缘树 Dialog `VariantLineageTreeDialog`

入口：

- 简历卡片菜单 `查看血缘树`
- 编辑器 toolbar Popover `查看血缘树` 按钮

UI：

- `ResponsiveDialog` `sm:max-w-2xl`
- 标题：`血缘树（共 N 份简历）`
- 主体：树状递归 `VariantLineageTree`
  - 节点 = 卡片，左侧 vertical line + L-shape 缩进表示父子关系
  - 节点 card 内容：`[icon] 简历名 · [Target/原创 badge] · matchRate`
  - 当前节点高亮：`ring-2 ring-primary` + 右上角 `<Target /> 当前`
  - 默认展开到深度 2
  - 失败/派生中节点：灰色虚线边框 + 状态 badge
- 操作：
  - `打开` → 切换当前简历 + 关闭 Dialog
  - `查看 JD` → 弹小 Popover 显示 JD 全文
  - `再派生一次` → 复用 JdVariantDialog Step 1 预填

### 5.7 列表页过滤 Tabs

`src/pages/resume/index.tsx` 顶部加：

```tsx
<Tabs value={filterMode} onValueChange={setFilterMode}>
  <TabsList>
    <TabsTrigger value="all">全部 ({total})</TabsTrigger>
    <TabsTrigger value="originals">原始简历 ({originals})</TabsTrigger>
    <TabsTrigger value="variants">JD 变体 ({variants})</TabsTrigger>
  </TabsList>
</Tabs>
```

状态存于 `useResumeListStore` 的 `filterMode`。

### 5.8 微交互细节

| 场景 | 处理 |
|---|---|
| 关键词 chip 渐入 | Tailwind `animate-in fade-in slide-in-from-bottom-1 duration-200` |
| 改写卡片高亮闪现 | 新加入时 `animate-in fade-in zoom-in-95 duration-300` |
| 进度条 | `Progress` 组件，0/25/50/100 |
| 长 reasoning 自动滚动 | `AutoScrollContainer`（已有） |
| Esc 在 textarea 内 | `e.stopPropagation()` 阻止误关 |
| 按钮 a11y | 流式中按钮 `onMouseDown e.preventDefault()` |
| 卡片 hover | `transition-shadow hover:shadow-md` |
| 派生中卡片角标 | `<Loader2 className="animate-spin" /> 派生中` |
| 失败卡片 | 红色虚线边框 + `<AlertCircle />` |

### 5.9 移动端兼容

- 所有 Dialog 走 ResponsiveDialog → 自动切 Drawer
- 步骤指示器在移动端折叠为 `Step 2 / 4` 文字
- 修改摘要在移动端默认全部折叠
- 血缘树在移动端横向滚动而不是缩放

### 5.10 国际化

- 与项目现状一致，**只支持中文**
- 文案集中存于 `src/components/jd-variant/const.ts` 的 `MESSAGES`

---

## §6 测试策略与里程碑

### 6.1 测试策略

#### 静态校验

- `pnpm exec tsc --noEmit` 0 错误
- `pnpm exec eslint <touched paths> --max-warnings 0` 0 错误
- 所有新增 `: void` / `: Promise<void>` 显式注解清理

#### 单元测试（vitest）

| 文件 | 重点用例 |
|---|---|
| `parse-variant-response.test.ts` | ① 完整合法 ② 单条字段缺失被丢弃 ③ section 不在白名单丢弃 ④ before/after 相同丢弃 ⑤ after 长度超阈丢弃 ⑥ 总条数 < 3 抛错 ⑦ 流式 partial JSON 容错 |
| `apply-changes.test.ts` | ① 数组段 itemId 替换 ② 'whole' 替换整段 ③ fieldPath 嵌套 ④ 不存在 itemId noop |
| `utils.test.ts` | ① buildEditableView 仅含白名单 ② 关键词归一化 ③ matchRate 计算 |
| `use-jd-variant-generator.test.ts` | ① 4 阶段顺序推进 ② abort 后 phase='aborted' ③ Phase 1 失败不创建草稿 ④ Phase 2 失败 markFailed ⑤ 重试复用 keywords |

#### 集成测试

- `variant-flow.integration.test.ts`：mock LLM + 端到端校验 4 列写入、状态机、ON DELETE SET NULL

#### 手测剧本（M1-M13）

| 编号 | 场景 |
|---|---|
| M1 | 列表页卡片菜单 → 派生 |
| M2 | 输入 30 字 JD → 提交 |
| M3 | Step 2 完成 → Step 3 |
| M4 | Step 3 完成 → Step 4 |
| M5 | Step 4「打开变体」 |
| M6 | Step 4「再生成一次」 |
| M7 | Step 4「丢弃」 |
| M8 | Step 3 中关闭 Dialog |
| M9 | Step 3 中网络断 |
| M10 | Optimize 比对底部派生 |
| M11 | 编辑器 toolbar 变体信息 |
| M12 | 卡片菜单查看血缘树 |
| M13 | 列表页 Tabs 过滤 |

#### Edge Case（E1-E8）

| 编号 | 场景 |
|---|---|
| E1 | 离线状态派生 → IDB |
| E2 | 未登录派生 → local-id |
| E3 | 删除源简历 → parent=null |
| E4 | 二级派生（变体的变体） |
| E5 | LLM before 不一致 → 丢弃 |
| E6 | LLM 输出非 JSON → markFailed |
| E7 | LLM 改写身份字段 → 丢弃 |
| E8 | 派生中刷新 → 状态保留 |

### 6.2 里程碑

#### G1：基础设施（无 UI）

- 数据层：Supabase migration（4 列）+ 类型补全
- IndexedDB v2 升级
- Schema：VariantMetadata / VariantChange / DerivedStatus
- `lib/llm/index.ts` 新增 `runJdVariantParse / runJdVariantRewrite`
- `lib/llm/prompts/jd-variant.ts`
- `lib/supabase/resume/variant.ts`（cloneResumeAsDraft / applyVariantChanges / markVariantReady / markVariantFailed / deleteDraftVariant / fetchVariantTree）
- `offline-resume-manager.ts` 透传同名能力
- 单测：utils / apply-changes / parse-variant-response

DoD：tsc + eslint 0；vitest 单测全过；底层函数可手动调用模拟全流程

#### G2：核心组件

- `components/jd-variant/` 全部源文件骨架
- `types.ts / const.ts / utils.ts`
- `parse-variant-response.ts / apply-changes.ts`
- `use-jd-variant-generator.ts`
- `use-variant-lineage.ts`
- 单测 + 集成测试

DoD：tsc + eslint 0；hook 集成测试覆盖 4 阶段 + abort + 重试

#### G3：派生 Dialog UI

- `jd-variant-dialog.tsx`
- `steps/step-input.tsx / step-parsing.tsx / step-rewriting.tsx / step-result.tsx`
- 错误态 + 取消二次确认

DoD：M1-M9 全过；移动端可用；a11y 警告 0

#### G4：列表页入口与卡片改造

- ResumeCard 菜单、`variant-badge.tsx`、底部派生自行
- 派生数角标
- DerivedJobsDialog
- 列表页 Tabs + filterMode

DoD：M1, M7, M8, M13；E3, E8

#### G5：Optimize 页入口接入

- `jd-derive-button.tsx`
- 复用 JD store 预填
- 跳过 Step 1

DoD：M10

#### G6：编辑器 toolbar + 血缘 Popover

- `variant-lineage-button.tsx`（条件挂载）
- `variant-lineage-popover.tsx`
- 源简历方向 N 个变体 Popover

DoD：M11

#### G7：血缘树 Dialog

- `variant-lineage-tree-dialog.tsx`
- `variant-lineage-tree.tsx`（递归 + 折叠 + 高亮）
- 节点操作

DoD：M12；E4

#### G8：打磨与最终验收

- 离线 / 未登录路径（E1, E2）
- LLM 异常容错（E5, E6, E7）
- a11y / 键盘导航 / 移动端
- DoD 自检表逐条验证

DoD：tsc + eslint 0；§1.2 全部 DoD 通过；E1-E8、M1-M13 全过

### 6.3 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| LLM 输出 changes 体量大，前端解析卡顿 | UX 差 | 流式增量 apply；`requestIdleCallback` 节流 |
| Supabase migration 在生产无回滚 | 数据丢失 | 4 列均 nullable + 默认 null；老简历不受影响；回滚仅删列 |
| IDB v2 迁移失败 | 离线变体不可用 | onupgradeneeded try/catch；失败降级为 v1 |
| 二级派生形成环 | 树死循环 | 深度 ≤ 5 + visited Set 双保险 |
| LLM 频繁失败 / 超时 | UX 差 | 「再生成一次」复用 keywords 跳过 Phase 1；> 90s 提示取消 |
| 用户改源简历后变体 metadata.before 与原文不一致 | 视觉错位 | 文档明确："变体派生后，源简历修改不会反向同步" |

### 6.4 关联文件

- 设计文档：`docs/superpowers/specs/2026-05-28-jd-driven-resume-variant-design.md`（本文件）
- 实施计划：`docs/superpowers/plans/2026-05-28-jd-driven-resume-variant.md`（待 writing-plans 阶段产出）

---

## 附：与既有模块的关系

- **复用**：`runBulletRewrite` 的流式 / 解析 / abort 模式；`runAtsStructured` / `runJobDescriptionStructured` 的 reasoning 流；`AnalysisTrace` 的 ChainOfThought UI 模式；`optimize-job-description-tool-storage` 的 JD 持久化 store
- **扩展**：`PersistedResumeRow` / `ResumeListItem` 加 4 个 nullable 列；`offline-resume-manager` DB 升 v2；`useResumeListStore` 加 `filterMode`
- **新增模块**：`src/components/jd-variant/`、`src/lib/llm/prompts/jd-variant.ts`、`src/lib/supabase/resume/variant.ts`、`src/lib/schema/resume/variant/`
- **不影响的模块**：编辑器 form store、表单校验、协作 / Automerge、ATS 评分、版本历史、模板系统
