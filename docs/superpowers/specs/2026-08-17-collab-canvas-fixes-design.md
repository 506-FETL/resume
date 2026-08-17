# 协作与 AI 画布体验修复 — 设计文档

日期：2026-08-17
范围：首页 ATS 趋势图 bug、协作加入链路两处 bug、AI 助手画布（会话级预览 / 变更记录折叠 / 定位高亮）、全局动效规范。

---

## 问题一：首页 ATS 分数趋势图只显示两个点

### 现状根因
- 图表：`src/pages/index/components/insight-cards/index.tsx` 的 `AtsTrendCard`（recharts `AreaChart`）。
- `XAxis dataKey="label"`，`label = formatRelativeTime(created_at)`，按整天粒度输出（"1 天前"）。
- recharts 类目轴（`type="category"`）把相同 label 视为**同一 x 坐标**并合并。8 次检测若落在同 1~2 个"相对天"桶里，屏幕与 tooltip 就只剩 1~2 个点。
- `AtsTrendPoint` 已有唯一 `index` 字段（`insights.ts`），但渲染时未使用。

### 方案
1. `XAxis` 改用唯一键：`dataKey="index"` + `type="number"`，配 `tickFormatter={(i) => trend[i]?.label ?? ''}`、`ticks`/`domain` 保证每点一个刻度。
2. 优化 x 轴文案：为趋势点增加更具区分度的 label（带序号或"日期 时:分"），避免同日多次检测标签完全重复。采用 `formatRelativeTime(created_at)` 作为主文案，同日多点时以时间点区分（复用 `dayjs` 输出 `M/D HH:mm` 或"第 N 次"）。tooltip 仍显示可读时间。
3. 单点场景保持可用（已有 `hasData` 判断）。

验收：8 次检测 → x 轴显示 8 个独立刻度点，hover 每个点都有 tooltip。

---

## 问题二：协作 Edge Function 报错文案不友好

### 现状根因
- `src/lib/collaboration/session/service.ts` `callCollaborationCommentOperation`：`supabase.functions.invoke` 在非 2xx 时返回 `FunctionsHttpError`，其 `error.message` 恒为 `"Edge Function returned a non-2xx status code"`。
- 现有代码 `if (error) throw new Error(error.message)` 直接透传，丢失后端响应体里的 `{ ok:false, error:{ code:'unauthorized', message:'简历所有者无需以协作者身份加入' } }`。
- 触发场景：简历所有者点开自己的协作链接（换设备/清缓存导致本地无 host 角色记录），`use-collaboration-panel-value.ts` 走 `joinSession`（guest），后端返回 403 unauthorized。

### 方案
1. **service.ts 解析响应体**：`error` 存在时，尝试 `await error.context?.json()` 读取后端 `{ code, message }`，抛出携带 `code` 的自定义错误（`CollaborationOperationError { code, message, status }`），使上层可按 `code` 分支处理。解析失败回退到友好中文默认文案（而非暴露英文原文）。
2. **所有者场景优雅化**：在 `use-collaboration-panel-value.ts` 自动加入 effect 中，先判断"当前用户是否为该简历所有者"。由于协作者/所有者身份可由后端 code 判定，采用：`joinSession` 捕获到 `code === 'unauthorized'` 且属于"所有者无需加入"语义时，**改走 `resumeHosting`**（因为他就是所有者，应以主持人身份恢复），或至少不弹红色 error toast，而是 `toast.info('你是该简历的所有者，已进入编辑')`。
   - 首选：`store.ts` 的 `joinSession` catch 中识别该 code，转调 `resumeHosting` 重连（无缝）。
3. 其它协作错误仍走中文友好 toast（不再出现英文 "non-2xx"）。

验收：所有者点自己的协作链接 → 不再出现红色英文报错；正常进入编辑（作为 host）。协作者遇到真实错误 → 中文提示。

---

## 问题三：协作者加入后简历为空（最严重）

### 现状根因（初始化时序 bug）
- 编辑器加载：`use-resume-loader.ts` → `loadResumeData(resumeId, { documentUrl })` → `document.ts` → `manager.initialize()`。
- `manager.initialize()`（`manager.ts`）里 `persistence.loadHandle(repo)` 对协作者走 `loadHandleByUrl` → `repo.find(docUrl)`。
- **此时 Supabase 网络适配器尚未挂载**（它要等 `joinSession` → `enableCollaboration` 才在 `session-manager.ts` `addNetworkAdapter`）。零 peer 下 `repo.find` 立即判定文档 `unavailable`，回退到 `createResumeDocument`（新建空白文档）。
- 之后 `joinSession` 挂上适配器，但已绑定到空白文档（documentId 与 docUrl 不同），同步的是错的文档，正文永远为空。
- 附带：`fetchVariantTree`（`variant.ts`）用协作者自己的 `user_id` 查所有者 `resume_config`，`.single()` 无行 → 406/PGRST116。是 console 噪音，不影响正文，但需消除。

### 方案
**核心：让协作者在网络适配器就绪后再通过 docUrl 加载文档。**

1. **调整初始化顺序（协作者路径）**：当 `loadResumeData` 带 `documentUrl` 时，`DocumentManager` 需要"先连协作通道，再 find(docUrl)"。具体：
   - 在 `manager.initialize()` 中，若存在 `sharedDocumentUrl`，先确保 collaboration session 的网络适配器已 `addNetworkAdapter` 并 `whenReady`（等到至少一个 peer 候选 / 通道 SUBSCRIBED），再 `repo.find(docUrl)`。
   - 由于会话 id 此刻可能未知（`joinSession` 才带 sessionId），改为：`use-resume-loader` / 协作面板在协作者场景下**先建立协作会话（挂适配器）**，再触发文档 find。即把 `enableCollaboration(sessionId)` 提前到 `find(docUrl)` 之前。
   - 落地方式：给 `DocumentManager` 增加"共享文档 + 已知 sessionId"的初始化路径，或在 `loadHandleByUrl` 中对 `repo.find` 增加"等待网络就绪 + 超时重试"，在适配器 ready 后重新 find。
2. **`repo.find(docUrl)` 容错**：加入"网络就绪后重试 + 合理超时（如 8s）"，避免零 peer 立即 unavailable。就绪信号取 `SupabaseNetworkAdapter.whenReady()` / peer-candidate。
3. **消除 406 噪音**：`fetchVariantTree` 及血缘按钮在"非本人简历（协作者）"场景禁用/跳过查询：
   - `VariantLineageButton`：`useVariantLineage(rootId)` 的 dialog 常驻挂载导致一进页面就查。改为仅在 `!disabled`（本人简历且有 parent）时才传入 rootId；协作者场景 `disabled=true` → 传 `null` → 不发请求。
   - 同时 `variant.ts` 的查询对 PGRST116 更宽容（返回空树而非 throw），避免抛红。

验收：协作者通过链接加入 → 简历正文与所有者一致（非空）；控制台无 406。

> 说明：automerge 时序修复涉及协作核心链路，实现时以"最小侵入 + 隔离验证"为原则；若无法在本地起真实双端，将建立等价隔离验证（模拟网络就绪时机）。

---

## 问题四：AI 助手画布

### 4A. 简历预览对应"每个会话正在查看/修改的简历"（方案 A：持久化到 DB）
现状：`use-canvas-preview.ts` 用全局 `useCurrentResumeStore.resumeId` 决定预览目标；会话与简历无绑定。

方案：
1. **DB 迁移**：`ai_conversations` 增列 `resume_id uuid NULL`（不加外键约束到 resume_config，避免删简历级联影响会话；仅记录绑定）。附 `updated_at` 触发无需改。RLS 已是 owner-only，无需新策略。
2. **数据层**：`conversations.ts` 的 `mapConversation` 增加 `resumeId`；新增 `updateConversationResumeBinding(id, resumeId)`；`AiConversation` 类型加 `resumeId: string | null`。
3. **写入绑定**：AI 工具 `open_resume` / `create_resume` 成功后，除 `setCurrentResume` 外，若存在 `activeConversationId`，写入该会话的 `resume_id` 绑定（内存 + DB）。用户在编辑器手动打开某简历并进入某会话时也同步绑定。
4. **读取预览**：`use-canvas-preview.ts` 解析优先级改为：`当前会话绑定的 resumeId` > 全局 currentResumeId（兜底）> 列表第一个。会话切换时预览随之切换。
5. store：assistant store 的 `AiConversation` 已含会话，读取 `conversations.find(activeConversationId).resumeId`。

验收：会话 A 打开简历甲、会话 B 打开简历乙；切换会话 → 画布预览随会话切换；刷新/换设备后仍保持。

### 4B. 变更记录一键折叠/展开
现状：`change-log/index.tsx` 每条 `Collapsible` 仅 `defaultOpen`，非受控，无批量控制。

方案：
1. 引入受控 open 状态集合 `openIds: Set<string>`（初始按 `defaultOpen` 规则填充）。
2. 每条 `Collapsible` 改 `open={openIds.has(id)}` + `onOpenChange`。
3. 顶部操作条增加"全部折叠 / 全部展开"切换按钮（依据当前展开比例显示对应动作）。

### 4C. 定位高亮美化 + 滚动不遮挡
现状：`handleLocate` 用 `el.scrollIntoView({block:'center'})`（被 sticky 标题栏遮挡）+ 内联 `box-shadow` 高亮（丑、不突出）。

方案：
1. **高亮**：CSS class 化，采用飞书风格——目标区块加"柔和主色背景脉冲 + ring 描边 + 圆角"的关键帧动画（`@keyframes locate-pulse`），~2s 后自动移除 class。比单薄的 2px box-shadow 更醒目、更有质感。伴随轻微入场。
2. **滚动不遮挡**：给可定位的 `resume-section-*` 元素设置 `scroll-margin-top`（大于 sticky 标题栏高度，约 56px），用 `block:'start'` 或 `nearest` 定位到标题栏下方；避免 `center` 造成的容器滚动遮挡。
3. 高亮/滚动逻辑保留重试（元素未挂载时）。

验收：点击定位 → 目标区块滚动到标题栏下方完整可见，出现醒目主色脉冲高亮，不被遮挡。

---

## 问题五：全局动效规范 + 补齐缺失动画

现状：动效常量分散（`share/const.ts`、`resume-comments/const.ts`、`motion-reorder.tsx` 等），无统一预设；变更记录 `CollapsibleContent` 展开无动画。

方案：
1. **新建 `src/lib/motion.ts`**：收敛项目既有动效风格为可复用预设常量：
   - 缓动：`EASE_OUT = [0.22, 1, 0.36, 1]`（招牌进入）、`EASE_OUT_SOFT`、`EASE_IN`（退出）。
   - 时长：`DURATION.fast=0.14 / base=0.2 / slow=0.28`。
   - spring：`SPRING.layout {500,40}`、`SPRING.bounce {300,24}`。
   - 常用 variants：`fadeInUp`、`fadeScale`、`collapse`。
   - 全部配合 `useReducedMotion`（在使用处降级，与项目现有约定一致）。
2. **变更记录折叠动画**：`CollapsibleContent` 加 `data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up`（复用 tw-animate-css / accordion 同款关键帧），使展开/折叠有高度过渡；配合内容淡入。
3. **补齐其它明显缺动画处**：变更记录列表项入场错峰、批量操作条出现过渡等（范围克制，聚焦本次涉及的画布区域）。
4. **AGENTS.md 写入规则**：新增"动效风格"约定条目——设计/实现功能时必须符合本仓库动效风格（引用 `src/lib/motion.ts` 预设，缓动/时长档位，进入=淡入+轻位移/缩放、退出更短更急，必须过 `useReducedMotion` 降级，折叠/展开必须有过渡动画）。

验收：变更记录展开/折叠有平滑动画；`src/lib/motion.ts` 落地；AGENTS.md 含动效规则。

---

## 交付与部署
- 涉及 Supabase 迁移（`ai_conversations` 加列）：开发验证后由本代理部署到已链接云端项目，完成迁移账本与线上核验。
- 不涉及 Edge Function 逻辑变更（问题二只改前端解析；问题三主要在前端 automerge 时序）。
- 构建校验：`pnpm build` / `tsc` 通过。
