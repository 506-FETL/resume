<p align="center">
  <img src="./public/resume_icon_transparent.svg" width="88" alt="GResume 图标" />
</p>

<h1 align="center">GResume</h1>

<p align="center">
  <strong>基础简历 + 岗位定制 + 版本分享 + 求职跟进</strong>
</p>

<p align="center">
  <a href="#技术实现"><img src="./docs/assets/readme/tech-badges.svg" width="860" alt="React、TypeScript、Vite、Tailwind CSS、Tiptap、Zustand、Supabase 与 MIT License 手绘技术徽章" /></a>
</p>

<p align="center">
  <a href="https://506resume.vercel.app/"><strong>在线体验</strong></a> ·
  <a href="#产品使用指南">产品使用指南</a> ·
  <a href="#开发与自托管">开发与自托管</a> ·
  <a href="#系统设计">系统设计</a> ·
  <a href="https://github.com/506-FETL/resume/issues">问题反馈</a>
</p>

<p align="center">
  <img src="./docs/assets/readme/hero.svg" width="1000" alt="GResume 从基础简历、岗位定制到分享与求职追踪的手绘工作台概览" />
</p>

---

## 目录

- [GResume](#gresume)
- [一条完整的求职工作流](#一条完整的求职工作流)
- [产品使用指南](#产品使用指南)
- [功能与使用边界](#功能与使用边界)
- [产品预览](#产品预览)
- [系统设计](#系统设计)
- [技术实现](#技术实现)
- [项目结构](#项目结构)
- [开发与自托管](#开发与自托管)
- [安全说明](#安全说明)
- [常见问题](#常见问题)
- [参与贡献](#参与贡献)
- [许可证](#许可证)
- [维护者与致谢](#维护者与致谢)

---

## GResume

GResume 是一套面向个人求职过程的工作台，把简历从创建到投递后的全过程连起来：同一份基础资料可以派生多个岗位版本，每个版本都能被分析、导出、分享，并与实际投递进度保持对应。

真实求职中，最容易丢失的往往不是简历文件，而是上下文：哪一版投给了哪家公司、为什么这样改、对方看到的是否还是当时那一版、下一次应该何时跟进。GResume 用统一的数据模型管理这些关系，减少文档副本、聊天记录和表格之间的来回切换。

### 适合谁

- 需要针对多个 JD 持续维护定制简历的求职者。
- 希望先在浏览器中开始、再按需启用云能力的个人用户。
- 需要固定版本分享、评论反馈或实时协作的求职小组与导师。
- 希望自行部署，并继续扩展简历、ATS、AI 或求职 CRM 能力的开发者。

---

## 一条完整的求职工作流

<p align="center">
  <img src="./docs/assets/readme/workflow.svg" width="1000" alt="Write、Tailor、Share、Track 四步手绘产品流程图" />
</p>

1. **Write** — 建立一份可复用的基础简历，在结构化编辑器中维护经历、技能与项目，并即时检查版式。
2. **Tailor** — 选择目标 JD，从基础简历派生独立版本；结合 ATS 结果和岗位重点修改内容，而不覆盖原始版本。
3. **Share** — 从当前内容或历史记录中选择一个确定版本，发布固定快照，并按需要配置密码、有效期和评论权限。
4. **Track** — 把投递公司、岗位阶段、面试轮次、联系人与下一步日期放进求职看板，始终知道接下来要推进什么。

这四步共享同一份简历数据模型。编辑、预览、ATS、AI、导出与分享不是互相孤立的工具，而是围绕“哪份简历正在服务哪次机会”协同工作。

---

## 使用指南

### 1. 先选择使用模式

| 使用模式   | 能做什么                                                   | 数据与依赖                                                    |
| ---------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| 未登录使用 | 创建和编辑本地简历、切换模板、预览内容                     | 简历保存在当前浏览器的 IndexedDB；不会自动出现在其他设备      |
| 登录使用   | 云同步、历史版本、JD 血缘、分享、评论、协作、Tracker 与 AI | 需要可用的 Supabase 项目和对应服务端能力                      |
| 自行部署   | 完整掌控前端、数据库、Edge Functions 和模型密钥            | 需要完成[开发与自托管](#开发与自托管)中的环境配置和数据库部署 |

如果只是体验编辑器，直接打开[在线版本](https://506resume.cc/)即可。准备长期使用、跨设备管理或发布分享链接时，再登录并启用云端能力。

### 2. 建立基础简历

1. 进入「我的简历」，创建一份基础简历。
2. 在编辑器中按模块填写个人信息、教育、工作、项目和技能。
3. 使用右侧预览检查分页、密度与信息层级。
4. 在模板工作台选择官方模板；需要更强的版式控制时，可基于模板继续自定义。
5. 将这份简历作为稳定的信息源。后续面向岗位的修改优先通过派生版本完成，不直接破坏基础版本。

> 建议先追求内容完整，再处理视觉细节。项目、经历和技能都稳定后，模板切换与导出会更可控。

### 3. 为目标 JD 派生版本

1. 选择一份基础简历并创建 JD 版本。
2. 粘贴岗位描述，保留公司、岗位与关键词上下文。
3. 运行 ATS 分析，查看结构、关键词、内容质量和可读性等维度的结果。
4. 根据证据逐项修改，不要为了分数堆叠无关关键词。
5. 保存后，该版本会保留与基础简历的派生关系，便于之后回看“为什么有这一版”。

JD 版本的核心价值是隔离：同一个项目经历可以针对不同岗位强调不同结果，但基础简历仍然保持稳定，其他岗位版本也不会被连带覆盖。

### 4. 使用 AI 助手优化内容

AI 助手可以读取你明确选择的简历、ATS 结果、历史版本与求职看板上下文，给出解释、改写建议或调用项目内工具。涉及写入的操作需要用户确认，避免模型在后台静默修改简历。

推荐的使用方式：

- 先让助手指出问题和依据，再决定是否改写。
- 每次聚焦一个目标，例如“压缩到一页”“强化量化结果”或“对齐这个 JD”。
- 写入后回到简历画布检查语义、事实和版式，不把模型输出直接视为最终结果。
- 不要把访问密钥、身份证件或与求职无关的敏感信息放入提示词。

### 5. 导出与检查交付文件

GResume 使用同一份结构化数据生成页面预览、PDF 和 Word。导出前建议依次检查：

- 姓名、联系方式、作品链接是否为本次投递所需内容。
- 页面是否出现孤行、断页或过密区域。
- JD 版本和目标公司是否对应，避免误投其他岗位版本。
- PDF 复制文本是否正常；Word 打开后是否存在字体替换或布局偏差。
- 文件名是否包含清晰的姓名、岗位或版本标识。

### 6. 发布固定分享快照

1. 进入分享页，选择当前内容或一个历史版本。
2. 设置便于自己识别的分享名称。
3. 按需要配置访问密码、有效期与评论权限。
4. 创建分享后再把链接交给招聘方、导师或协作者。
5. 当链接不再需要时，可以关闭、归档或删除，不必修改原始简历。

分享内容是创建时的固定快照。之后继续编辑本地简历，不会悄悄改变已经发出的版本；如果需要更新对方看到的内容，应明确发布新快照。

### 7. 记录投递和下一步

在 Tracker 中为每个机会记录公司、职位、所用简历、当前阶段、面试轮次、联系人、活动时间线与下一步日期。Dashboard 会聚合待跟进岗位、ATS 趋势、近期动态和需要处理的简历任务。

推荐把下一步写成可执行动作，例如“周三前补充作品集链接”或“面试后 24 小时内发送感谢邮件”，而不是模糊的“继续跟进”。

---

## 功能与使用边界

| 能力            | 用户得到什么                           | 使用边界                                                 |
| --------------- | -------------------------------------- | -------------------------------------------------------- |
| 本地优先编辑    | 不注册也能开始创建和编辑简历           | 浏览器数据不会自动跨设备同步；清理站点数据前应先确认备份 |
| 模板与实时预览  | 同一份内容可切换布局并即时查看效果     | 不同系统字体和打印引擎可能造成轻微排版差异               |
| JD 定制与 ATS   | 版本隔离、评分、问题证据和优化方向     | ATS 是项目内的规则评估，不等同于招聘平台内部算法         |
| 历史与版本血缘  | 回看迭代记录，识别基础版和派生版关系   | 云端历史需要登录和数据库配置                             |
| PDF / Word 导出 | 从统一数据模型生成交付文件             | 导出后仍需人工检查字体、分页和事实准确性                 |
| 固定快照分享    | 明确控制对外版本、密码、有效期和状态   | 持有链接且满足访问条件的人可以查看对应内容               |
| 评论与实时协作  | 围绕具体内容收集反馈或共同编辑         | 需要 Realtime、评论函数和相关密钥正确配置                |
| 求职看板        | 管理阶段、面试、联系人、活动与下一步   | 不自动连接招聘网站，也不代替用户实际投递                 |
| AI 求职助手     | 基于项目内上下文对话、分析和确认后写入 | 需要 `llm-proxy`、模型密钥与可用额度；输出必须人工核验   |

---

## 产品预览

<table>
  <tr>
    <td width="50%">
      <img src="./docs/assets/readme/screenshots/dashboard.jpg" alt="GResume Dashboard 的今日待办、ATS 趋势与待跟进岗位" />
    </td>
    <td width="50%">
      <img src="./docs/assets/readme/screenshots/assistant-workspace.jpg" alt="GResume AI 助手与简历预览画布" />
    </td>
  </tr>
  <tr>
    <td align="center"><sub><strong>Dashboard</strong> — 把简历优化、投递进度和下一步动作汇总到一个入口</sub></td>
    <td align="center"><sub><strong>AI Workspace</strong> — 对话、工具调用、变更记录和简历画布并排协作</sub></td>
  </tr>
</table>

> 截图来自本地开发环境；示例简历中的姓名、联系方式和求职记录均为演示数据。

---

## 系统设计

GResume 把高频编辑路径放在浏览器内：页面动作进入 Zustand 领域状态，Tiptap 与模板运行时负责编辑和呈现，IndexedDB 与 Automerge 保存本地文档。即使用户尚未登录，核心写作流程也不需要等待云端往返。

登录后，Supabase 提供身份、受 RLS 约束的数据、Realtime 与 Edge Functions。分享、评论、维护任务和模型请求等需要服务端能力的流程统一进入对应函数；DeepSeek 密钥只存在于服务端环境中，不进入浏览器构建产物。

<p align="center">
  <img src="./docs/assets/readme/architecture.svg" width="1000" alt="GResume 本地优先浏览器工作区、Supabase 云端能力与 DeepSeek 服务的手绘系统架构图" />
</p>

### 数据放在哪里

| 数据类型                          | 主要位置                     | 说明                                                  |
| --------------------------------- | ---------------------------- | ----------------------------------------------------- |
| 未登录简历文档                    | 浏览器 IndexedDB / Automerge | 适合立即编辑；不自动跨设备出现                        |
| 登录后的简历、版本与 Tracker 数据 | Supabase PostgreSQL          | 由会话和 RLS 控制访问范围                             |
| 字符级协作状态                    | Yjs + Supabase Realtime      | 用于协作更新、在线状态和光标等实时消息                |
| 分享与评论                        | PostgreSQL + Edge Functions  | 函数负责访问令牌、快照、评论和特权流程                |
| AI 请求                           | `llm-proxy` Edge Function    | 浏览器发送所需上下文，服务端携带模型密钥请求 DeepSeek |
| PDF / Word                        | 用户设备                     | 从当前选择的简历版本生成并下载                        |

### 一次“岗位定制并分享”的时序

<p align="center">
  <img src="./docs/assets/readme/product-sequence.svg" width="1000" alt="从选择基础简历和 JD、请求 AI 建议、确认写入到发布固定分享快照的手绘时序图" />
</p>

时序图中的云端消息只在已登录且相应能力可用时发生。未登录编辑不会向 DeepSeek 发起请求；AI 返回的是建议或待确认的工具结果，不应绕过用户确认直接改写简历。

---

## 技术实现

| 层级         | 核心技术                                          | 在项目中的职责                                       |
| ------------ | ------------------------------------------------- | ---------------------------------------------------- |
| Web 基础     | React 19、TypeScript 5.9、Vite 7                  | 页面、类型系统、文件路由与构建                       |
| 视觉与交互   | Tailwind CSS 4、Radix UI、Base UI、Motion、Lucide | 主题、无障碍组件、动效与图标                         |
| 简历编辑     | Tiptap 3、模板 registry / runtime                 | 结构化内容编辑、模板解析、预览与呈现                 |
| 状态管理     | Zustand 5                                         | 应用级状态、页面级领域状态和业务动作                 |
| 本地优先数据 | IndexedDB、Automerge                              | 浏览器持久化、文档模型与本地合并                     |
| 实时协作     | Yjs、Tiptap Collaboration、Supabase Realtime      | 富文本更新、协作会话、光标和实时事件                 |
| 云端后端     | Supabase Auth、PostgreSQL、RLS、Edge Functions    | 身份、数据隔离、分享、评论和服务端流程               |
| AI           | AI SDK 6、OpenAI SDK 类型/流工具、DeepSeek API    | 兼容 OpenAI 协议的类型、SSE 解析、工具调用和模型代理 |
| 数据校验     | Zod 4                                             | 简历、模板、ATS 与工具输入的运行时校验               |
| 文档交付     | `docx`、浏览器打印                                | Word 生成与 PDF 输出                                 |
| 工程质量     | ESLint、TypeScript、pnpm                          | 静态检查、类型检查和依赖管理                         |

这里的技术栈只列出会影响系统边界和开发方式的主要依赖；完整且可执行的版本以 [`package.json`](./package.json) 和 [`pnpm-lock.yaml`](./pnpm-lock.yaml) 为准。

---

## 项目结构

```text
resume/
├── docs/assets/readme/          # README 手绘 SVG 与产品截图
├── public/                      # 应用图标、字体和第三方许可证说明
├── src/
│   ├── components/              # 跨页面复用的 UI 与基础组件
│   ├── features/                # 评论等按领域组织的功能模块
│   ├── hooks/                   # 跨页面 Hooks
│   ├── lib/                     # ATS、AI、协作、Supabase、模板等核心能力
│   ├── pages/                   # Dashboard、简历、模板、分享、AI、Tracker 等页面
│   ├── store/                   # 应用级与领域级 Zustand stores
│   └── utils/                   # 通用工具函数
├── supabase/
│   ├── functions/               # 分享、评论、模型代理、缓存与运维函数
│   ├── migrations/              # PostgreSQL 结构、RLS 与 RPC 迁移
│   └── tests/                   # Supabase 数据库验证
├── package.json                 # 命令、依赖与 pnpm 版本
├── vite.config.ts               # Vite、MDX、Tailwind 和分包配置
└── vercel.json                  # SPA 重写与部署响应头
```

页面通常把 UI、hooks、常量、类型、工具和页面级 store 放在对应目录中。跨页面共享的数据进入 `src/store/` 或 `src/lib/`，只服务单个组件的临时界面状态保留在组件内部。

---

## 开发与自托管

### 环境要求

- Node.js 24（仓库的 [`.nvmrc`](./.nvmrc) 指定版本）
- pnpm 10.33.3（由 `packageManager` 固定）
- 如需完整云端能力：Supabase CLI、一个 Supabase 项目和可用的 DeepSeek API key

### 1. 获取代码并安装依赖

```bash
git clone https://github.com/506-FETL/resume.git
cd resume
corepack enable
pnpm install --frozen-lockfile
```

### 2. 配置浏览器环境变量

在项目根目录创建 `.env.local`：

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_BASE_URL=http://localhost:5173
VITE_COLLABORATION_PROTOCOL_V2_ENABLED=false
```

| 变量                                     | 必需性 | 说明                                                   |
| ---------------------------------------- | ------ | ------------------------------------------------------ |
| `VITE_SUPABASE_URL`                      | 必需   | Supabase 项目 URL；客户端初始化和云端请求都会使用      |
| `VITE_SUPABASE_PUBLISHABLE_KEY`          | 必需   | 可公开的 publishable / anon key；权限仍必须由 RLS 控制 |
| `VITE_BASE_URL`                          | 建议   | 应用基地址，用于认证回调或分享链接                     |
| `VITE_RESUME_COMMENTS_FUNCTION_REGION`   | 可选   | 评论函数区域；未设置时由客户端自动解析                 |
| `VITE_COLLABORATION_PROTOCOL_V2_ENABLED` | 可选   | 协作协议 v2 开关；当前默认关闭                         |

所有 `VITE_` 变量都会进入浏览器构建产物。这里只能放允许公开的客户端配置，不能放 service role key、DeepSeek key 或评论签名密钥。

### 3. 启动前端

```bash
pnpm dev
```

打开 `http://localhost:5173`。生产构建与本地预览：

```bash
pnpm build
pnpm preview
```

### 4. 配置 Supabase 云端能力

仓库中的 `supabase/migrations/`、`supabase/functions/` 和 `supabase/config.toml` 描述数据库与函数配置。部署完整后端时，需要将迁移应用到目标项目，并部署使用到的 Edge Functions。

下列值应配置为 Supabase secrets，不能写进前端环境文件：

| Secret                                      | 使用场景                                                                           |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` | Supabase 托管的 Edge Functions 会自动注入；不要暴露给浏览器                        |
| `OPENAI_API_KEY`                            | 兼容旧变量名；当前必须填写 DeepSeek API key，供 `llm-proxy` 请求 `deepseek-v4-pro` |
| `RESUME_COMMENT_TOKEN_SECRET`               | 评论访问令牌签名                                                                   |
| `RESUME_COMMENT_COLLABORATOR_SECRET`        | 协作者凭据保护                                                                     |
| `RESUME_COMMENT_ANONYMOUS_PEPPER`           | 匿名评论身份派生                                                                   |
| `RESUME_COMMENT_REALTIME_SECRET`            | 评论实时通道保护                                                                   |
| `BACKEND_MAINTENANCE_TOKEN`                 | 后端维护与缓存刷新任务鉴权                                                         |
| `GITHUB_TOKEN`                              | GitHub stars 缓存刷新                                                              |
| `OPS_ALERT_WEBHOOK_URL`                     | 后端运维告警 Webhook                                                               |
| `COLLABORATION_LEGACY_REGISTER_CUTOFF_AT`   | 旧协作注册流程的截止时间                                                           |

#### 最小远端部署流程

以下命令以 Supabase 托管项目为目标；执行前请先阅读官方的[环境管理](https://supabase.com/docs/guides/deployment/managing-environments)、[函数部署](https://supabase.com/docs/guides/functions/deploy)和[函数密钥](https://supabase.com/docs/guides/functions/secrets)说明。

1. 登录 CLI 并把仓库链接到目标项目：

   ```bash
   supabase login
   supabase link --project-ref <project-ref>
   ```

2. 检查并应用仓库中的数据库迁移：

   ```bash
   supabase db push --dry-run
   supabase db push
   supabase migration list
   ```

3. 把服务端密钥写入已被 `.gitignore` 排除的 `supabase/functions/.env`，再上传到目标项目：

   ```dotenv
   # 变量名为历史兼容命名，值必须是 DeepSeek API key
   OPENAI_API_KEY=your-deepseek-api-key
   RESUME_COMMENT_TOKEN_SECRET=replace-with-a-long-random-secret
   RESUME_COMMENT_COLLABORATOR_SECRET=replace-with-a-different-random-secret
   RESUME_COMMENT_ANONYMOUS_PEPPER=replace-with-a-different-random-secret
   RESUME_COMMENT_REALTIME_SECRET=replace-with-a-different-random-secret
   BACKEND_MAINTENANCE_TOKEN=replace-with-a-long-random-token
   ```

   ```bash
   supabase secrets set --env-file supabase/functions/.env
   supabase secrets list
   ```

   `GITHUB_TOKEN` 和 `OPS_ALERT_WEBHOOK_URL` 只在启用对应缓存刷新与告警流程时设置；不要把真实值粘贴到 README、Issue 或终端截图中。

4. 部署仓库实际使用的五个 Edge Functions：

   ```bash
   supabase functions deploy resume-share
   supabase functions deploy resume-comments
   supabase functions deploy llm-proxy
   supabase functions deploy github-stars-refresh
   supabase functions deploy backend-ops-monitor
   ```

5. 在 Supabase Dashboard 的 **Authentication → URL Configuration** 中，把生产站点设为 Site URL，并把 `http://localhost:5173/editor` 与生产环境的 `<VITE_BASE_URL>/editor` 加入 Redirect URLs。最后使用普通用户完成登录、密码重置、分享和 AI 请求的 smoke 检查。

### 常用命令

| 命令           | 作用                             |
| -------------- | -------------------------------- |
| `pnpm dev`     | 启动 Vite 开发服务器             |
| `pnpm build`   | 运行 Vite 生产构建并生成生产资源 |
| `pnpm preview` | 本地预览生产构建                 |
| `pnpm lint`    | 运行 ESLint                      |

---

## 安全说明

- 不要提交 `.env`、`.env.local`、service role key、DeepSeek key、维护令牌或评论/协作密钥。
- 浏览器只能使用 Supabase publishable / anon key；授权边界由数据库 RLS 和服务端校验共同保证。
- 不要用“前端隐藏按钮”代替权限控制，也不要把 service role key 注入 `VITE_` 变量。
- 分享密码和有效期用于限制访问，但分享链接仍应按敏感资源管理；失去控制后应及时关闭或删除。
- 简历通常包含姓名、联系方式、教育和工作经历。提交 Issue、截图或日志前，请先删除个人信息和令牌。
- AI 请求会把完成任务所需的上下文发送到模型服务。自行部署者应根据自己的数据政策、地区要求和供应商条款决定是否启用。
- 发现安全问题时，不要在公开 Issue 中附带可利用细节、真实简历或密钥；请先通过维护者主页提供的联系方式私下沟通。

---

## 常见问题

<details>
<summary><strong>不登录能使用吗？</strong></summary>

可以在在线版本中创建和编辑本地简历。数据主要保存在当前浏览器；云同步、历史版本、分享、评论、实时协作、Tracker 和 AI 需要登录及对应云端能力。

</details>

<details>
<summary><strong>本地数据会自动同步到其他设备吗？</strong></summary>

不会。IndexedDB 中的数据属于当前浏览器环境。需要跨设备使用时，应登录并确认云同步已经完成；清理浏览器数据、重装系统或更换设备前不要假设本地内容已经备份。

</details>

<details>
<summary><strong>修改简历后，已发送的分享链接会跟着变化吗？</strong></summary>

不会。分享使用固定快照，保证接收方看到的是创建链接时选择的版本。需要更新内容时，应创建或更新一个明确的新快照。

</details>

<details>
<summary><strong>ATS 分数越高越好吗？</strong></summary>

分数适合用来发现结构、关键词和机器可读性问题，不适合代替事实质量与人工判断。优先保证经历真实、表达清楚、与岗位相关，再把评分作为检查工具。

</details>

<details>
<summary><strong>AI 会自动修改我的简历吗？</strong></summary>

AI 可以提出建议或准备工具操作；涉及写入时需要确认。任何生成内容都应检查事实、语气、岗位匹配和页面布局。

</details>

<details>
<summary><strong>为什么导出的 Word 和预览略有不同？</strong></summary>

浏览器、操作系统、Word 版本和本机字体都会影响排版。交付前应在目标软件中重新检查分页、字体替换、项目符号和链接。

</details>

---

## 参与贡献

欢迎通过 [Issues](https://github.com/506-FETL/resume/issues) 提交可复现的问题、真实使用场景或范围清晰的改进建议。

1. Fork 仓库并从当前主线创建聚焦的功能分支。
2. 遵循现有 TypeScript、页面模块、状态管理、组件 primitive 和动效约定。
3. 在提交前运行与改动相关的验证，并至少执行 `pnpm build`。
4. Pull Request 中说明问题、方案、验证方式；界面变化请附截图或录屏。
5. 涉及迁移、RLS、Edge Functions、分享或协作协议时，说明数据和兼容性影响。

当前公开计划以 [GitHub Issues](https://github.com/506-FETL/resume/issues) 和仓库实际变更为准，README 不维护未经确认的发布日期或版本承诺。

---

## 许可证

本项目采用 [MIT License](./LICENSE)。你可以在保留版权和许可证声明的前提下使用、复制、修改、合并、发布和分发本项目；软件按“原样”提供，不附带保证。

---

## 维护者与致谢

GResume 由 [506-FETL](https://github.com/506-FETL) 维护。

项目建立在 React、Tiptap、Zustand、Automerge、Yjs、Supabase、Tailwind CSS、AI SDK 等开源项目之上。字体、图标和组件的第三方许可证说明位于 [`public/licenses`](./public/licenses/)。

也感谢每一位提交 Issue、Pull Request、设计反馈和真实求职场景的贡献者。一个具体、可复现的问题，往往比一句“可以更好”更能推动项目向前。
