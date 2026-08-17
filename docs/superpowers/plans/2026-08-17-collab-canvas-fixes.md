# 协作与 AI 画布体验修复 实现计划

> **面向 AI 代理的工作者：** 使用 superpowers:subagent-driven-development 或直接内联执行本计划。步骤用复选框跟踪。本仓库不写测试（见 AGENTS.md），验证以 `pnpm build`/`tsc` + 隔离逻辑验证为准。

**目标：** 修复首页 ATS 趋势图数据点塌陷、协作加入两处 bug（错误文案 + 协作者简历为空）、AI 画布会话级预览/变更记录折叠/定位高亮，并沉淀全局动效规范。

**架构：** 前端 React + Zustand + recharts + motion；Supabase（Postgres + RLS + Edge Functions）；简历正文用 Automerge CRDT + Supabase Realtime 同步。

**技术栈：** TypeScript, React, Zustand, recharts, motion/react, @automerge/automerge-repo, Supabase JS。

设计文档：`docs/superpowers/specs/2026-08-17-collab-canvas-fixes-design.md`

---

### 任务 1：修复 ATS 趋势图数据点塌陷（问题一）

**文件：**
- 修改：`src/pages/index/insights.ts`（atsTrend 构造，label 去重）
- 修改：`src/pages/index/components/insight-cards/index.tsx:187-199`（XAxis）

- [ ] **步骤 1：insights.ts 让同批次点 label 具区分度**
  - `atsTrend` 的 `label` 保留相对时间，但对同一相对时间的多点追加时间点（`M/D HH:mm`）以区分；tooltip 用可读时间。保留 `index`。
- [ ] **步骤 2：XAxis 改唯一键**
  - `<XAxis dataKey="index" type="number" domain={[0,'dataMax']} ticks={trend.map(t=>t.index)} tickFormatter={(i)=>trend[i]?.label ?? ''} interval={0} .../>`
  - 确认 `Area dataKey="score"` 不变；tooltip label 显示 `trend[i].label`。
- [ ] **步骤 3：构建校验** `pnpm build` 通过。
- [ ] **步骤 4：Commit** `fix(dashboard): 修复 ATS 趋势图数据点因相对时间重复而塌陷`

---

### 任务 2：协作 Edge Function 错误文案优雅化（问题二）

**文件：**
- 修改：`src/lib/collaboration/session/service.ts:81-99`（解析响应体）
- 新增/修改：`src/lib/collaboration/session/types.ts`（错误类型）
- 修改：`src/lib/collaboration/session/store.ts:140-169`（joinSession 识别 owner）

- [ ] **步骤 1：定义可识别错误**
  - service.ts 内定义 `class CollaborationOperationError extends Error { code?: string; status?: number }`。
- [ ] **步骤 2：解析 FunctionsHttpError 响应体**
  - `if (error)` 分支：`const body = await (error as any)?.context?.json?.().catch(()=>null)`；取 `body?.error?.code / message`；`throw new CollaborationOperationError(message||友好中文, code, status)`。不再透传英文 message。
- [ ] **步骤 3：joinSession 识别 owner 无缝转 host**
  - store.ts `joinSession` catch：若 `error.code === 'unauthorized'` 且 message 含"所有者"，改调 `get().resumeHosting(params)` 并 return（不弹 error）。否则原逻辑。
- [ ] **步骤 4：构建校验** `pnpm build`。
- [ ] **步骤 5：Commit** `fix(collab): 所有者加入自身协作链接改为无缝主持并优雅化错误提示`

---

### 任务 3：修复协作者简历为空 + 消除 406（问题三）

**文件：**
- 修改：`src/lib/automerge/document/persistence.ts`（loadHandleByUrl 网络就绪重试）
- 修改：`src/lib/automerge/document/manager.ts`（协作者先连后 find）
- 修改：`src/lib/automerge/collaboration/session-manager.ts`（暴露 whenReady）
- 修改：`src/lib/supabase/resume/variant.ts`（PGRST116 宽容）
- 修改：`src/pages/resume/editor/components/toolbar/variant-lineage-button.tsx`（协作者禁用血缘查询）

- [ ] **步骤 1：血缘查询容错，消除 406**
  - `variant.ts` `fetchVariantTree`：根节点 `.single()` 改 `.maybeSingle()`；无行时返回 `{ root: 最小占位, currentId }` 或 throw 一个不打红的空树标记。
  - `variant-lineage-button.tsx`：dialog 常驻挂载导致查询，改为仅 `!disabled && rootId` 时传 rootId；协作者（列表查不到该 resume）→ disabled → 不查询。
- [ ] **步骤 2：session-manager 暴露适配器就绪 Promise**
  - 新增 `whenAdapterReady(): Promise<void>`，内部 `await adapter.whenReady()`。
- [ ] **步骤 3：manager 协作者路径先连后 find**
  - `DocumentManager` 增加 `initializeShared(sessionId, callbacks)`：先 `enableCollaboration(sessionId)` 挂适配器 → `await whenAdapterReady()` → 再 `persistence.loadHandle`（find docUrl，此时有 peer）。
  - 或在 `persistence.loadHandleByUrl` 里对 `repo.find` 增加"就绪等待 + 超时(8s) + 重试"。选就绪等待方案，改动更聚焦。
- [ ] **步骤 4：串联加载顺序**
  - `use-resume-loader` / 协作面板：协作者场景（有 docUrl + collabSession）确保 `enableCollaboration` 在 `find(docUrl)` 前完成。评估 `document.ts` loadResumeData 传入 sessionId 的可行性；若时序复杂，采用"find 重试直到适配器 ready"的最小侵入方案。
- [ ] **步骤 5：隔离验证**
  - 由于双端实时难本地复现，编写/运行等价隔离验证脚本或在 `dev` 起双标签页手动核验：协作者正文非空、无 406。至少 `pnpm build` 通过并逻辑走查。
- [ ] **步骤 6：Commit** `fix(collab): 协作者在网络就绪后加载共享文档，修复正文为空与血缘 406`

---

### 任务 4：会话-简历绑定 DB 迁移 + 数据层（问题四-A 上）

**文件：**
- 创建：`supabase/migrations/20260817000003_add_ai_conversation_resume_binding.sql`
- 修改：`src/lib/ai/types.ts`（AiConversation.resumeId）
- 修改：`src/lib/supabase/ai/conversations.ts`（map + update binding）

- [ ] **步骤 1：迁移 SQL**
```sql
-- 20260817000003_add_ai_conversation_resume_binding.sql
-- AI 会话绑定当前查看/编辑的简历，用于画布预览按会话切换。
ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS resume_id uuid;
COMMENT ON COLUMN public.ai_conversations.resume_id IS '该会话当前绑定的简历 resume_id（画布预览用，可为空）';
```
- [ ] **步骤 2：类型 + map**
  - `AiConversation` 加 `resumeId: string | null`；`mapConversation` 加 `resumeId: row.resume_id ?? null`。
- [ ] **步骤 3：新增绑定写入函数**
  - `conversations.ts`：`updateConversationResumeBinding(id, resumeId: string | null)` → update `{ resume_id }`（带 user_id）。`createConversation` select `*` 已含新列。
- [ ] **步骤 4：构建校验 + 本地迁移** `supabase db reset --local`（或验证 SQL 语法），`pnpm build`。
- [ ] **步骤 5：Commit** `feat(assistant): 会话表新增 resume 绑定列与数据层`

---

### 任务 5：画布预览按会话切换（问题四-A 下）

**文件：**
- 修改：`src/pages/assistant/hooks/use-canvas-preview.ts`（解析优先级）
- 修改：`src/lib/ai/tools/crud.ts`（open_resume/create_resume 写绑定）
- 修改：`src/pages/assistant/store.ts`（upsertConversation 保留 resumeId；提供设置入口）

- [ ] **步骤 1：读取会话绑定**
  - `use-canvas-preview.ts`：读 `useAssistantStore(s=>s.activeConversationId)` 与 `conversations`；`boundResumeId = conversations.find(id).resumeId`；解析优先级 `boundResumeId(在列表中) > currentResumeId > options[0]`。
- [ ] **步骤 2：open/create 写绑定**
  - `crud.ts` `open_resume`、`create_resume` apply 成功后：若 `useAssistantStore.getState().activeConversationId` 存在 → 调用 `updateConversationResumeBinding` + `upsertConversation` 更新内存态 resumeId。
- [ ] **步骤 3：会话切换即时反映**
  - 确认 `use-canvas-preview` 依赖 `activeConversationId` 变化重算预览目标。
- [ ] **步骤 4：构建校验** `pnpm build`。
- [ ] **步骤 5：Commit** `feat(assistant): 画布简历预览随会话绑定切换`

---

### 任务 6：变更记录一键折叠/展开（问题四-B）

**文件：**
- 修改：`src/pages/assistant/components/assistant-canvas/change-log/index.tsx`

- [ ] **步骤 1：受控 open 状态**
  - `const [openIds,setOpenIds]=useState<Set<string>>(()=>初始按 defaultOpen 规则收集 diff 项 id)`。
  - `Collapsible` 用 `open={openIds.has(change.id)}` + `onOpenChange`。
- [ ] **步骤 2：顶部批量按钮**
  - 顶部操作条加"全部折叠/全部展开"按钮（依据 `openIds` 覆盖度切换文案与动作），仅当存在可折叠项时显示。
- [ ] **步骤 3：构建校验** `pnpm build`。
- [ ] **步骤 4：Commit** `feat(assistant): 变更记录支持一键全部折叠/展开`

---

### 任务 7：定位高亮美化 + 滚动不遮挡（问题四-C）

**文件：**
- 修改：`src/pages/assistant/components/assistant-canvas/change-log/index.tsx`（handleLocate）
- 修改：`src/index.css`（locate-pulse keyframes + class）
- 修改：`src/components/resume/runtime/renderers/shared.tsx` 和 `BasicsRenderer.tsx`（scroll-margin）

- [ ] **步骤 1：CSS 高亮类 + keyframes**
  - `src/index.css` 加 `@keyframes locate-pulse`（主色柔和背景 + ring 描边，2s 缓出）与 `.resume-locate-highlight` 类；`scroll-margin-top` 通过工具类或直接给 section。
- [ ] **步骤 2：handleLocate 改造**
  - 用 `el.classList.add('resume-locate-highlight')`，`animationend`/`setTimeout(2000)` 移除；滚动改 `el.scrollIntoView({block:'start'})` 且 section 有 `scroll-mt-14`（>标题栏高度）。
- [ ] **步骤 3：给定位目标加 scroll-margin**
  - `RuntimeSection`/`BasicsRenderer` 的 `resume-section-*` 元素加 `scroll-mt-14`（或 CSS 全局 `[id^="resume-section-"]{scroll-margin-top:3.5rem}`）。
- [ ] **步骤 4：构建校验** `pnpm build`。
- [ ] **步骤 5：Commit** `feat(assistant): 重做变更记录定位高亮为脉冲样式并修复滚动遮挡`

---

### 任务 8：动效预设 + 补动画 + AGENTS.md（问题五）

**文件：**
- 创建：`src/lib/motion.ts`
- 修改：`src/pages/assistant/components/assistant-canvas/change-log/index.tsx`（折叠动画 + 列表入场）
- 修改：`src/index.css`（collapsible keyframes 如缺）
- 修改：`AGENTS.md`（动效规则）

- [ ] **步骤 1：新建 motion.ts 预设**
  - 导出 `EASE`, `DURATION`, `SPRING`, `fadeInUp`, `fadeScale`, `collapse` 等常量/variants；注释说明配合 `useReducedMotion`。
- [ ] **步骤 2：变更记录折叠动画**
  - `CollapsibleContent` 加 `overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up`（确认 tw-animate-css 提供该 keyframes；否则在 index.css 补）。
- [ ] **步骤 3：列表入场错峰（克制）**
  - 变更列表项用 motion 淡入 + 轻微上移，`delay:index*0.02`，过 `useReducedMotion` 降级。
- [ ] **步骤 4：AGENTS.md 写规则**
  - 新增"动效风格"小节：功能设计/实现须符合仓库动效风格，引用 `src/lib/motion.ts`；缓动/时长档位；进入=淡入+轻位移/缩放，退出更短更急；折叠/展开必须有过渡；必须 `useReducedMotion` 降级；弹窗动画验收沿用既有规则。
- [ ] **步骤 5：构建校验** `pnpm build`。
- [ ] **步骤 6：Commit** `feat(motion): 新增动效预设并补齐变更记录动画，AGENTS.md 写入动效规则`

---

### 任务 9：部署与线上核验

- [ ] **步骤 1：部署迁移到云端** `supabase db push`（或 migration up），确认 `ai_conversations.resume_id` 列上线。
- [ ] **步骤 2：迁移账本核验** `supabase migration list` 显示新迁移已应用。
- [ ] **步骤 3：线上 smoke** 确认会话绑定读写正常、无 406、协作正文非空、ATS 图多点。
- [ ] **步骤 4：最终构建** `pnpm build` 通过。

---

## 自检
- 规格五个问题均有对应任务（1→一，2→二，3→三，4/5→四A，6→四B，7→四C，8→五，9→部署）。
- 无占位符：每步给出具体文件与做法。
- 类型一致：`updateConversationResumeBinding`、`AiConversation.resumeId`、`CollaborationOperationError`、`openIds`、`.resume-locate-highlight` 在相关任务间一致引用。
- 部署门禁：任务 9 覆盖 Supabase 迁移部署与核验。
