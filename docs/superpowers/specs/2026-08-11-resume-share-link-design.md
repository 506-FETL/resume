# 简历只读分享链接 · 设计规格

- 日期：2026-08-11
- 主题：resume-share-link
- 状态：已批准（brainstorming 阶段完成，待 writing-plans）

## 1. 背景与目标

用户希望把某一份简历通过生成一个链接分享出去，别人拿到链接就能查看该简历。

经需求探索，确定核心语义如下（均为用户逐项确认）：

| 决策点 | 结论 |
|---|---|
| 链接语义 | **可撤销的临时链接**：生成后持续有效，owner 可随时手动关闭使其失效，可选设置有效期 |
| 内容语义 | **快照固化**：生成链接那一刻固化简历内容，之后改简历不影响已发链接；提供「推送最新版到此链接」手动更新 |
| 访问门槛 | **默认开即看**，但可选设访问密码；可在「无密码 ↔ 需密码」之间随时切换，切换立即对已发链接生效 |
| 链接数量 | **一简历多链接**：同一份简历可同时存在多个独立链接，各自可命名 / 设密码 / 撤销 / 统计 |
| 访问统计 | **记录查看次数与最后查看时间** |
| 隐私范围 | **沿用简历现有可见性**（visibility），与导出 PDF 行为一致 |
| 下载权限 | **允许访问者下载 PDF** |
| 管理入口 | **编辑器内** + **简历列表卡片** 双入口 |
| 路由形式 | **完整路径 `/resume/view/:token`** |
| 密码哈希 | **服务端计算哈希**（明文不落库、不进前端日志） |

## 2. 关键技术约束（探索得出）

1. **RLS 锁死**：`resume_config` 为 owner-only RLS（`user_id = auth.uid()`），匿名访问者默认读不到任何简历。这是分享功能必须跨过的核心门槛。
2. **只读渲染能力已存在**：`src/components/resume/scaled-readonly-preview.tsx` 与 `ResumeTemplateRuntime` + `buildTemplateResumeData(snapshot)` 已能完整还原简历，查看页可直接复用。
3. **快照数据契约已存在**：`PersistedResumeSnapshot`（表单数据 + order + visibility + type + templateBinding + 外观 spacing/font/theme）即自包含的完整快照类型，历史版本 `resume_config_versions.snapshot` 存的正是它。分享快照复用此 schema。
4. **PDF 导出可复用**：`src/pages/history/components/version-pdf-export/index.tsx` 的模式（`react-to-print` + 离屏 `PagedResumeShell` + `ResumeTemplateRuntime`）可直接搬到分享页。
5. **已有协作分享链接是另一回事**：`buildCollaborationShareUrl` 生成的是可编辑协作链接（需登录、进编辑器），与本功能的只读查看链接不可混用。
6. **文件系统路由**：`~react-pages`，新增页面文件即新增路由。`App.tsx` 依 `location.pathname` 选择套 `DashboardShell` / `AssistantShell`。
7. **仅云端简历可分享**：离线简历（`resume.isOffline`）数据只在本地 IndexedDB，服务端无副本，无法生成可访问链接。

## 3. 数据模型（后端）

新建 `public.resume_shares` 表，与 `resume_config` 解耦（快照独立存储，天然绕开 owner-only RLS）。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid PK default gen_random_uuid() | |
| `resume_id` | uuid not null | 关联源简历，`on delete cascade`（删简历时其所有分享链接一并失效） |
| `user_id` | uuid not null default auth.uid() | owner |
| `token` | text unique not null | 访问凭证，长随机串，URL 用它 |
| `label` | text | 链接名称（如「字节专用」），owner 自定义 |
| `snapshot` | jsonb not null | 固化的简历内容，形态 = `PersistedResumeSnapshot` |
| `display_name` | text | 快照时的简历标题（分享页标题栏用） |
| `is_active` | boolean not null default true | 撤销 = 置 false（软删除，保留统计） |
| `password_hash` | text null | 访问密码哈希（null = 开即看）；可变字段，切换密码即改它 |
| `expires_at` | timestamptz null | 可选有效期（null = 永久） |
| `view_count` | int not null default 0 | 访问次数 |
| `last_viewed_at` | timestamptz null | 最后查看时间 |
| `created_at` | timestamptz not null default now() | |
| `updated_at` | timestamptz not null default now() | 由触发器维护 |

外键：
- `resume_shares_resume_id_fkey` → `resume_config(resume_id)` on delete cascade
- `resume_shares_user_id_fkey` → `auth.users(id)` on delete cascade

索引：`token`（unique）、`(user_id, resume_id)`、`(resume_id) where is_active`。

### RLS 策略

- owner 对自己的记录有全部权限（select/insert/update/delete）——`auth.uid() = user_id`，用于管理面板。
- 匿名 / 任何人**不能直接 SELECT 这张表**（避免拖库、避免读到 `password_hash`）。
- 匿名读取简历内容走 Edge Function（第 4 节），使用 service_role 绕过 RLS 并脱敏。

## 4. 匿名访问机制（后端核心）

新建 Supabase Edge Function `resume-share`（复用现有 `supabase/functions/` 基建，使用 service_role）。它是匿名读取的唯一入口，也是涉及密码写入的入口。

### 4.1 GET（匿名读取，无需鉴权）

`GET ?token=xxx`（密码经 POST body 传，不进 URL/日志）：

1. 按 `token` 查记录；查不到 → 404，统一文案。
2. `is_active = false` → 返回「链接已关闭」。
3. `expires_at` 已过 → 返回「链接已过期」。
4. `password_hash` 非空且请求未带正确密码 → 返回 `{ needPassword: true }`，**不返回简历内容**。
5. 校验通过 → 原子自增 `view_count`、更新 `last_viewed_at`，返回 `{ snapshot, display_name }`。**永不返回 `password_hash`、`user_id` 等敏感字段。**

为降低信息泄露，「不存在 / 已关闭 / 已过期」对访问者可用统一空状态文案（内部可区分，前端展示收敛）。

### 4.2 密码写入（owner 鉴权）

设密码 / 改密码 / 清密码时，前端把明文密码 POST 给该 Function，携带 owner JWT：Function 校验身份（`user_id = auth.uid()` 且该 share 属于此 owner）→ 用 bcrypt 算哈希 → 写入 `password_hash`（清密码则置 null）。明文不落库、不进前端日志。

### 4.3 为什么用 Edge Function 而非直接开 anon SELECT

- 直接开 anon SELECT 会让 `password_hash` 对所有人可见，密码形同虚设；
- 无法实现「密码错误时不返回内容」的条件逻辑；
- Edge Function 把「校验 + 脱敏 + 计数 + 密码哈希」收敛到服务端一处，是熵最低方案。

## 5. 发起方（前端生成 / 管理）

### 5.1 快照生成

点击「分享」时，从当前 store 完整状态（`getFormPayload` + 外观配置）序列化出 `PersistedResumeSnapshot`。store 里富文本字段已是 Yjs 合并后的最新 HTML，快照天然完整，避免协作富文本遗漏。

### 5.2 新增 Zustand store：`src/store/resume-share/`（应用级）

跨「编辑器内」「列表卡片」两入口共享。actions：

- `createShare(resumeId, snapshot, displayName, options)` — 无密码时走客户端 SDK insert（owner RLS 写）；带密码时走 Edge Function（服务端算哈希）。
- `listShares(resumeId)` — 查该简历所有链接。
- `revokeShare(id)` / `activateShare(id)` — 改 `is_active`（客户端 SDK）。
- `updateSharePassword(id, password | null)` — 设 / 改 / 清密码（走 Edge Function）。
- `updateShareLabel(id, label)` / `updateShareExpiry(id, expiresAt)` — 客户端 SDK。
- `pushLatestSnapshot(id, snapshot)` — 重新快照覆盖（客户端 SDK）。
- `deleteShare(id)` — 真删除（区别于撤销，客户端 SDK）。

写操作分工：
- 涉及密码（建带密码链接 / 改密码 / 清密码）→ Edge Function。
- 不涉及密码（改名称、撤销 / 启用、改有效期、删除、推送新快照）→ 客户端 SDK + owner RLS。

### 5.3 管理 UI：`ShareDialog`

两入口共用组件，内含：

- 新建链接：可填名称 / 密码 / 有效期。
- 已有链接列表：每条显示名称、URL + 复制按钮、访问次数、最后查看时间、状态开关（撤销 / 启用）、改密码、删除、「推送最新版到此链接」。

入口挂载：
- 编辑器内：`src/pages/resume/editor/components/collaboration/collaboration-controls/index.tsx` 的「开启协作」旁加「分享」按钮。
- 列表卡片：`src/pages/resume/components/resume-card/index.tsx` 加「分享」入口；离线简历置灰提示「先同步到云端」。

## 6. 消费方（分享页）

### 6.1 路由与外壳

新增 `src/pages/resume/view/[token].tsx` → `/resume/view/:token`。此页**不套** `DashboardShell` / `AssistantShell`（面向外部匿名者，不应出现登录用户侧边栏 / 导航）。在 `App.tsx` 外壳判断中为 `view` 路由开「裸壳」分支。

### 6.2 页面状态机

1. 加载中 → 调 `resume-share` Function `GET ?token`。
2. 需要密码（`needPassword: true`）→ 展示密码输入框，提交后带密码重新请求。
3. 成功 → `buildTemplateResumeData(snapshot)` + `ResumeTemplateRuntime` 渲染只读简历（复用 `ScaledReadonlyPreview` 或直接组合）；顶部轻量栏含简历标题 + 「下载 PDF」（复用 `react-to-print` 离屏打印模式）。
4. 失效 / 过期 / 不存在 → 友好统一空状态页，不泄露简历存在性差异。

### 6.3 动效

用 `motion/react` 做加载 → 内容过渡，尊重 `prefers-reduced-motion`。

## 7. 边界与非目标（YAGNI）

明确不做：
- ❌ 实时同步（已定快照）。
- ❌ 访问者留言 / 评论 / 反馈。
- ❌ 细粒度字段级隐藏（沿用简历 visibility，额外隐藏留作后续）。
- ❌ 访问者身份识别 / 邮箱收集 / 水印。
- ❌ 限次 / 阅后即焚（已定可撤销临时链接）。
- ❌ 测试（遵循本仓库 no-tests 默认）。

关键边界处理：
- 离线简历：分享入口置灰，提示先同步云端。
- 删除源简历：`on delete cascade` 连带删除所有分享链接。
- 快照与源简历解耦：改简历不影响已发链接，需手动「推送最新版」。
- 统一失败文案：不区分「不存在」与「已关闭」，降低探测。

## 8. 涉及文件清单（预估）

新增：
- `supabase/migrations/20260811xxxxxx_add_resume_shares.sql`
- `supabase/functions/resume-share/index.ts`
- `src/store/resume-share/`（store 与类型）
- `src/lib/supabase/resume-share/`（数据访问封装）
- `src/pages/resume/view/[token].tsx`（分享页）
- `ShareDialog` 组件（位置待计划确定）

修改：
- `src/App.tsx`（裸壳路由分支）
- `src/pages/resume/editor/components/collaboration/collaboration-controls/index.tsx`（分享按钮）
- `src/pages/resume/components/resume-card/index.tsx`（分享入口）
- `README.md`（功能说明同步）
