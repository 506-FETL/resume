# 协作光标昵称移除与通知昵称修复实施计划

> **给代理执行者：** 必须使用 superpowers:executing-plans 在当前会话按任务逐步实现本计划；不得使用子代理。步骤使用复选框（`- [ ]`）跟踪，执行时必须把本文件同步更新为最新状态。

**目标：** 保留富文本远端彩色光标竖线但彻底移除昵称气泡，并让加入/退出协作通知稳定显示真实昵称，同时按用户要求删除仓库全部测试代码。

**架构：** 光标构造器不再创建 label DOM，SCSS 只保留竖线规则；协作启动从已加载的 `currentUser` 同步解析昵称，避免第二条异步认证链路。presence leave 事件把 metadata 传到会话层，会话层在移除 participant 前按事件与缓存数据解析昵称。

**技术栈：** React 19、TypeScript、Zustand、Supabase Realtime Presence、Tiptap/Yjs、SCSS、pnpm/Vite

**设计规格：** `docs/superpowers/specs/2026-07-26-collaboration-caret-label-removal-and-notification-names-design.md`

**约束：** 保持当前分支；只做本地提交，不 push；用户明确要求不新增测试并删除全局测试文件，故本计划不执行 TDD，以 ESLint、TypeScript、生产构建和人工双端验收替代。

---

## 文件职责映射

- `src/lib/collaboration/richtext/caret-dom.ts`：只构造远端彩色光标竖线。
- `src/components/tiptap-node/paragraph-node/paragraph-node.scss`：只保留远端光标竖线样式，移除 label 与失败的 atomic 样式。
- `src/hooks/use-current-user.ts`：提供基于现成 Supabase User 的同步展示名解析函数。
- `src/pages/resume/editor/index.tsx`：为鼠标协作与 UI 同步使用同一展示名。
- `src/pages/resume/editor/components/collaboration/index.tsx`：为协作会话启动提供同一展示名。
- `src/lib/automerge/shared/types.ts`：允许离开事件携带 presence metadata。
- `src/lib/automerge/collaboration/supabase-network-adapter.ts`：把 `leftPresences` metadata 传出适配层。
- `src/lib/collaboration/session/callbacks.ts`：统一解析加入/退出昵称并生成通知。
- `eslint.config.js`、`package.json`、`pnpm-lock.yaml`：移除仅用于已删除测试的配置与直接依赖。

### 任务 1：清理失败实验与全部测试资产

**文件：**

- 删除：`src/lib/collaboration/richtext/caret-style.test.ts`
- 删除：`src/lib/collaboration/richtext/caret-dom.test.ts`
- 删除：`src/lib/collaboration/richtext/caret-dedupe.test.ts`
- 删除：`src/lib/collaboration/richtext/caret-lifecycle.integration.test.ts`
- 修改：`eslint.config.js`
- 修改：`package.json`
- 修改：`pnpm-lock.yaml`
- 回退未提交实验：`src/lib/collaboration/richtext/caret-dedupe.ts`
- 删除未采用文档：`docs/superpowers/specs/2026-07-26-collaboration-caret-stale-awareness-design.md`
- 删除未采用文档：`docs/superpowers/plans/2026-07-26-collaboration-caret-stale-awareness.md`
- 修改：此前 atomic 规格与计划，标记被本方案取代

- [ ] 删除全部四个当前/已跟踪的协作光标测试文件。
- [ ] 删除 `eslint.config.js` 中只匹配协作富文本测试的覆盖块。
- [ ] 运行 `pnpm remove -D happy-dom`，同步更新 `package.json` 与 `pnpm-lock.yaml`。
- [ ] 把 `caret-dedupe.ts` 回到当前 HEAD 已提交实现，不保留未完成的身份桥接实验。
- [ ] 删除未采用的 stale-awareness 规格/计划，并让旧 atomic 文档明确指向本设计。
- [ ] 全局扫描源码，确认不存在 `*.test.*`、`*.spec.*`、`__tests__` 或测试目录；设计文档 `.spec.md` 除外。

### 任务 2：彻底移除昵称气泡但保留光标竖线

**文件：**

- 修改：`src/lib/collaboration/richtext/caret-dom.ts`
- 修改：`src/components/tiptap-node/paragraph-node/paragraph-node.scss`

- [ ] 删除 `caret-dom.ts` 中 label 的创建、文字写入和 append，只返回带用户颜色的 caret `span`。
- [ ] 更新函数注释，明确该构造器只输出彩色竖线。
- [ ] 删除 SCSS 的 `--tt-collaboration-carets-label` 明暗变量及整个 `&__label` 规则。
- [ ] 保留 caret 的边框、负 margin、pointer-events 和定位；确认失败的 `display/width/height/vertical-align` atomic 声明不存在。
- [ ] 用 `rg` 确认源码不再创建或引用 `.collaboration-carets__label`。

### 任务 3：消除协作启动昵称竞态

**文件：**

- 修改：`src/hooks/use-current-user.ts`
- 修改：`src/pages/resume/editor/index.tsx`
- 修改：`src/pages/resume/editor/components/collaboration/index.tsx`

- [ ] 在 `use-current-user.ts` 增加同步 `getUserDisplayName(user)`：优先返回修剪后的 `full_name`，缺失时对已登录用户返回 `用户-<id前六位>`，无用户返回空字符串。
- [ ] `Editor` 基于 `useResumeLoader()` 返回的同一个 `currentUser` 调用该函数，删除独立的 `useCurrentUserName()` 订阅。
- [ ] `CollaborationPanelProvider` 基于 `useUserStore` 的同一个 `currentUser` 调用该函数，删除独立的 `useCurrentUserName()` 订阅。
- [ ] 确认 `startSharing`、`joinSession`、`resumeHosting`、鼠标光标和 UI 同步均获得同一个稳定展示名。

### 任务 4：让退出通知携带并解析真实昵称

**文件：**

- 修改：`src/lib/automerge/shared/types.ts`
- 修改：`src/lib/automerge/collaboration/supabase-network-adapter.ts`
- 修改：`src/lib/collaboration/session/callbacks.ts`

- [ ] 将 `CollaborationCallbacks.onPeerLeave` payload 扩展为可选 `metadata`。
- [ ] presence leave 处理器从每条 `leftPresences` 读取 `presence.metadata` 并随 `peerId` 传给回调。
- [ ] 在 callbacks 中增加局部昵称解析函数，按 `metadata.userName`、`metadata.name`、匿名 peer 兜底解析。
- [ ] 加入通知复用统一解析函数。
- [ ] 退出通知在删除 participant 前读取缓存 metadata，并按“事件 metadata → participant metadata → 兜底”显示“`<昵称> 退出协作`”。
- [ ] 检查自端 peer 过滤逻辑保持不变，避免自己收到自己的加入/退出通知。

### 任务 5：验证、记录与本地提交

**文件：**

- 修改：本计划

- [ ] 运行相关 ESLint：`pnpm exec eslint eslint.config.js src/hooks/use-current-user.ts src/pages/resume/editor/index.tsx src/pages/resume/editor/components/collaboration/index.tsx src/lib/automerge/shared/types.ts src/lib/automerge/collaboration/supabase-network-adapter.ts src/lib/collaboration/session/callbacks.ts src/lib/collaboration/richtext/caret-dom.ts src/lib/collaboration/richtext/caret-dedupe.ts src/lib/collaboration/richtext/collab-extensions.ts --max-warnings 0`。
- [ ] 运行 `pnpm exec tsc --noEmit` 与 `npx tsc --noEmit`；既有 `src/components/jd-variant/components/steps/step-parsing.tsx` 的 `ScrollArea` 未使用错误保持如实记录，不修改无关文件。
- [ ] 运行 `pnpm build`、`git diff --check` 和全局测试文件扫描。
- [ ] 直接审查最终 diff，确认没有删除设计文档、没有更改远端光标竖线能力、没有推送远端。
- [ ] 更新所有执行记录后，本地提交：`fix(collab): remove caret labels and preserve participant names`。
- [ ] 交给用户双账号验证加入、退出通知以及富文本光标展示；未获得真实浏览器结果前不宣称人工验收通过。
