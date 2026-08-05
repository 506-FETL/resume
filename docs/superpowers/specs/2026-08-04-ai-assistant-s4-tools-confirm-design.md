# AI 助手 · S4 工具集 + 混合确认 — 设计规格

- 日期：2026-08-04
- 子项目：S4（序列第 4 个：S1 数据层 ✓ → S2 页面骨架 ✓ → S3 Agent 引擎 ✓ → **S4 工具集+确认** → S5 入口集成 → S6 图片理解）
- 范围：`src/lib/ai/agent/**`（工具集扩展 + 写工具挂起机制）、`src/lib/ai/tools/**`（新增业务工具，按域拆分）、`src/pages/assistant/**`（system 概况注入、确认卡组件、store 的 pendingConfirm 态）
- 目标：把内部**全域用户数据打通进 agent**——只读工具覆盖简历完整内容/看板/模板/历史/ATS/派生/用户，写工具聚焦"当前简历字段 + 看板职位"，写操作走**内联确认卡**（权限 C）。让 agent 真正"什么都知道"，直接治好"只能看到简历名称和类型、无法对比内容"的问题。

## 背景与依赖

- S3 已交付：agent loop（`src/lib/ai/agent/`：tool-registry / stream-parser / to-api-messages / agent-loop）、`AgentTool` 注册表、tool-call part 渲染（GAIA `Tool Calls Section`）、进行中 `streamingParts` 态、内置 2 个只读占位工具（S4 替换）。
- 已盘点的现成数据入口（全部按 `user_id` 隔离，见探查）：
  - 简历：`getAllResumesFromUser()`、`getResumeById(id, selector='*')`（完整内容）
  - 看板：`getCompanies()`、`createCompany()`、`updateCompany(id, patch)`
  - 模板：`listUserTemplates()`；历史：`listResumeHistoryVersionSummaries()`；ATS：`getAtsFromUserId()`；派生：`fetchVariantTree(id)`；用户：`getUserProfile()` / `getCurrentUser()`
  - ⚠️ 简历正文走 Automerge CRDT：安全写入必须经 store `useResumeStore` 的 `updateForm(key,data)` / `updateFormFields(key,value,ops)`（`src/store/resume/form.ts`），直写 `resume_config` 会绕过协同。故写简历字段**仅限当前打开的简历**。

## 已定决策（与用户确认）

- **范围 = A**：全域**只读**打通；**写**聚焦两类——当前打开简历的字段（经 store CRDT 安全通道）+ 看板职位增改（`updateCompany`/`createCompany`，无 CRDT 问题）。任意非当前简历正文写、模板/历史/ATS 写 → 移交后续期（YAGNI）。
- **上下文 = A**：每次发消息前拼**轻量用户概况**注入 system（身份/日期/简历列表摘要/当前打开简历/看板状态分布/能力说明），深度内容按需调工具。
- **确认卡 = A**：写操作在对话流内渲染**内联确认卡**（GAIA 视觉语汇 + shadcn 手搭，lucide 图标，GAIA 无精确对应件），确认才落库。

## 全局约束（沿用）

前端 loop；FC（非 MCP）；`deepseek-v4-pro`；GAIA 优先（Tool Calls Section 已用；确认卡 GAIA 无对应件→shadcn 手搭对齐风格）；禁 props 下钻、组件超阈值拆分。

## 交付物

### 1. 工具集（扩展 `AgentTool`，按域拆分到 `src/lib/ai/tools/`）

**`AgentTool` 增加 `mode` 字段**（`tool-registry.ts`）：
```ts
interface AgentTool {
  name: string
  description: string
  parameters: Record<string, unknown>
  mode: 'read' | 'write' // read 自动执行；write 走确认卡
  execute: (args: Record<string, unknown>) => Promise<unknown>
}
```

**只读工具（`mode:'read'`，自动执行）：**
| 工具 | 入口 | 用途 |
|---|---|---|
| `get_current_time` | 本地 | 时间 |
| `list_resumes` | `getAllResumesFromUser` | 简历列表（名称/类型/派生状态）|
| `get_resume_detail` `{resumeId}` | `getResumeById(id,'*')` | 某份简历完整内容（各模块）|
| `list_jobs` | `getCompanies` | 看板全部职位 |
| `get_job` `{jobId}` | `getCompanies` 结果按 id 取 | 单职位详情 |
| `get_ats` `{resumeId}` | `getAtsFromUserId` 按 resumeId 过滤 | ATS 评分/建议 |
| `get_variant_tree` `{resumeId}` | `fetchVariantTree` | JD 派生血缘 |
| `list_templates` | `listUserTemplates` | 用户模板 |
| `list_resume_versions` `{resumeId}` | `listResumeHistoryVersionSummaries` 过滤 | 历史版本摘要 |
| `get_user_profile` | `getUserProfile` | 用户信息 |

**写工具（`mode:'write'`，走确认卡）：**
| 工具 | 入口 | 约束 |
|---|---|---|
| `update_current_resume_field` `{sectionKey, value}` | store `updateForm`（整段）/ `updateFormFields`（细粒度，S4 先用 `updateForm`） | 仅当前打开简历；非当前/未打开 → 返回提示"请先在编辑器打开该简历" |
| `update_job` `{jobId, patch}` | `updateCompany` | 改看板职位字段（status/notes/next_action 等）|
| `create_job` `{data}` | `createCompany` | 新增看板职位 |

- 工具按域拆文件：`tools/resume.ts` / `tools/tracker.ts` / `tools/misc.ts`（time/profile/template/history/ats），各自 `registerTool`。`src/lib/ai/tools/index.ts` 副作用导入全部；`agent/index.ts` 改为导入 `../tools` 替代 S3 的 `builtin-tools`（后者删除或保留 time）。
- 只读失败一律返回 `{ error }` 对象，不 throw 出循环（沿用 S3 约定）。
- `sectionKey` 取值对齐简历 12 模块（`basics`/`work_experience`/`project_experience`/`skill_specialty`/… 见 schema），工具 description 列出可选值，`parameters` 用 enum 约束。

### 2. 轻量概况预注入（`to-api-messages` system 头动态化）

- `to-api-messages.ts` 的 `SYSTEM_PROMPT` 从常量改为**接受一个 `context` 参数**动态拼接。
- 新增 `src/lib/ai/agent/build-context.ts`：`buildUserContext()` → 拉 `getAllResumesFromUser` + `getCompanies`（摘要口径）+ `getUserProfile` + 当前 `useResumeStore` 的 resumeId/名称 + 当天日期，拼成轻量字符串（不含正文，控制在数百 token）：
  ```
  当前用户：<name/email>；今天：<YYYY-MM-DD>。
  简历（共 N 份）：#1「…」(type) …
  当前正在编辑：<「…」resumeId=xxx> 或 「当前未打开简历」
  求职看板：共 M 个（已投递 x/面试中 y/Offer z/…）
  能力：可调工具读取任意简历完整内容、看板、ATS 等；可修改当前简历字段与看板职位（需你确认）。
  ```
- `use-chat-stream` 起 loop 前调用 `buildUserContext()`，传入 `runAgent`，由 `to-api-messages` 拼进 system 头。失败降级为基础 system（不阻断对话）。
- "当前打开简历"来源：`useResumeStore.getState()`（全局简历 store 的 `resumeId` + `basics.name`/display）。

### 3. 内联确认卡 + 写工具挂起机制（权限 C）

**挂起—确认—恢复**（前端 loop 天然支持，无需改循环结构）：
- 写工具的 `execute(args)` **返回一个挂起的 Promise**：向 store 写入一条 `pendingConfirm`（含 `id`、工具名、拟改摘要 `preview`、`resolve`/`reject` 句柄），Promise 等待用户决定。
- `agent-loop` 的 `await tool.execute()` 因此天然暂停在该工具处；进行中 `tool-call` part 标 `state:'awaiting-confirm'`。
- 对话流内渲染**内联确认卡**（读 store `pendingConfirm`）：展示改动 diff（简历字段 原值→新值 / job patch 摘要）+ [取消] [确认应用]。
- **确认** → 真正执行写入（`update_current_resume_field`→store `updateForm`；`update_job/create_job`→`updateCompany/createCompany`）→ resolve Promise（返回结果）→ `tool-call` part `state:'result'`（"已应用"）→ loop 恢复，结果回填模型继续。
- **取消** → resolve 为 `{ cancelled:true }`（不 reject，避免中断整轮）→ part `state:'cancelled'`（"已取消"）→ loop 恢复，模型得知用户取消。
- **abort/切会话** → reject 挂起的 Promise（AbortError），清 `pendingConfirm`。
- 一次一个确认（串行）：同一轮多个写调用依次弹卡（loop 本就顺序 await 每个 tool）。

**store 新增**（`src/pages/assistant/store.ts`）：
```ts
pendingConfirm: {
  id: string
  toolName: string
  preview: ConfirmPreview // { kind:'resume-field'|'job-update'|'job-create', title, diff?/summary }
  resolve: (result: unknown) => void
} | null
setPendingConfirm / clearPendingConfirm
```

**确认卡组件**（`src/pages/assistant/components/confirm-card/`，shadcn 手搭，GAIA 视觉语汇）：
- `index.tsx`：卡片壳（标题 + 内容 + 取消/确认按钮）
- `resume-field-diff.tsx`：简历字段改动的原值→新值展示
- `job-change-summary.tsx`：看板职位增改摘要
- 渲染位置：消息流底部（`pendingConfirm` 非空时），在进行中气泡之后。

**写入安全**：
- `update_current_resume_field`：校验目标是当前打开简历；经 `useResumeStore.getState().updateForm(sectionKey, value)`（CRDT 安全）
- `update_job/create_job`：`updateCompany/createCompany`，成功后同步 `useTrackerStore`（若看板页打开则实时反映）
- 落库失败：part 标 `state:'error'` + 回填模型

### 4. parts 落库与渲染

- 写工具产生的 `tool-call` part 增加 `state` 取值 `awaiting-confirm | result | error | cancelled`（扩展 S1 的 `AiMessagePart` tool-call 联合的 state；`AiToolCallState` 加 `awaiting-confirm`/`cancelled`）。
- 已落库的写 tool-call 用 GAIA Tool Calls Section 展示（已应用/已取消/错误态）；确认卡本身只在**进行中**（`pendingConfirm` 存在时）出现，不落库为卡片（落库的是 tool-call part 的最终 state）。

## 单元隔离与边界

- `src/lib/ai/tools/` 按域拆分，每个工具单一职责，只依赖现成 supabase 入口 + store 读写；registry 统一注册。
- `build-context` 纯拉取拼串，无副作用于对话。
- 确认卡挂起机制封装在写工具 `execute` + store `pendingConfirm`，`agent-loop` 循环结构不变（仍是 `await execute`）。
- 确认卡组件按职责拆（壳/简历diff/看板摘要），props 只接自己那条 preview，跨组件状态走 store。

## 错误 / 边界

- 只读工具失败 → `{error}` 回填，循环继续（S3 约定）。
- 写工具：非当前简历 → 返回提示不弹卡；确认前 abort → reject 清理；落库失败 → error 态回填。
- `buildUserContext` 失败 → 降级基础 system，不阻断。
- maxSteps=8 沿用；thinking 默认关沿用。

## 验证（本仓库不写测试）

1. `pnpm lint` + `pnpm build` + `tsc --noEmit` 全绿。
2. 手动清单（`pnpm dev` → `/assistant`，已登录、S1 迁移已执行）：
   - **读全域**：问"对比我两份简历的差异" → 调 `get_resume_detail` 两次 → 逐项对比（治截图痛点）；"我投了哪些公司/看板情况" → `list_jobs`；"我这份简历 ATS 分数" → `get_ats`
   - **概况感知**：一进来问"你知道我的情况吗" → 能说出简历数量/当前打开哪份/看板概况（不靠调工具也有基本盘）
   - **写-当前简历**：编辑器打开某简历 → 助手页问"把工作经历第一条改得更量化" → 弹内联确认卡（原值→新值）→ 确认 → 编辑器实时更新；取消 → 不变
   - **写-看板**：让"把某职位状态改为面试中" → 确认卡 → 确认后看板更新
   - **未打开简历写**：不在编辑器时让改简历字段 → 提示"请先打开该简历"，不弹卡
   - 刷新：读/写 tool-call parts（含已应用/已取消态）重现
   - 中断：确认卡待确认时停止/切会话 → 挂起清理、不脏写

## 非目标（YAGNI / 移交）

- 任意非当前简历的正文批量写、模板/历史/ATS/派生的写操作 → 后续期
- 图片理解（vision）→ S6
- 侧栏入口沉浸式升级 → S5（入口本身 S2 已加）
- 模型切换、语音、@提及 → 后续
- 不改现有 ATS/JD/改写等既有功能
