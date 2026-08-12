# GResume 自托管与部署

本文说明如何在本地运行 GResume，以及如何连接 Supabase、部署 Edge Functions 和启用 AI、分享、协作等完整能力。

## 系统组成

- 前端：React + Vite，可部署到 Vercel 或任意静态托管平台；
- 数据与认证：Supabase Auth、PostgreSQL、Storage、Realtime；
- 服务端能力：Supabase Edge Functions；
- AI：前端调用 `llm-proxy`，模型密钥只保存在 Edge Function 环境中。

## 环境要求

- Node.js 24+；
- pnpm；
- 完整云端能力需要 Supabase 项目和 Supabase CLI；
- AI 能力需要 DeepSeek 兼容 API Key。

## 仅使用离线编辑

如果只需要在当前浏览器中创建和编辑简历，不必配置 Supabase：

```bash
git clone https://github.com/506-FETL/resume.git
cd resume

corepack enable
pnpm install
pnpm dev
```

访问 `http://localhost:5173`。离线简历保存在浏览器 IndexedDB 中，清理站点数据或更换浏览器前请先完成需要的导出或同步。

## 连接 Supabase

在项目根目录创建 `.env.local`：

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_BASE_URL=http://localhost:5173
```

`VITE_BASE_URL` 用于密码重置等需要返回前端的链接。生产部署时将它改为实际站点地址。

### 初始化数据库

在新的 Supabase 项目中：

1. 先执行 `supabase/migrations/table.sql`，创建核心表与基础策略；
2. 再按文件名顺序执行 `supabase/migrations/` 下以日期开头的迁移文件；
3. 确认 Auth、Realtime、Storage 和相关 RLS 策略已经生效。

迁移覆盖简历派生、求职 CRM、AI 会话和消息、聊天附件、AI 额度、用户资料、版本岗位关联、GitHub Star 记录，以及版本化只读分享。

## 部署 Edge Functions

先登录并关联 Supabase 项目：

```bash
supabase login
supabase link --project-ref your-project-ref
```

### AI 代理

`llm-proxy` 负责验证用户身份、检查服务端额度并转发白名单参数。前端不会接触模型密钥。

```bash
supabase secrets set OPENAI_API_KEY=your-deepseek-api-key
supabase functions deploy llm-proxy
```

`OPENAI_API_KEY` 是当前代码沿用的环境变量名，实际请求发送到 DeepSeek 兼容接口。AI 功能要求用户已登录。

### 简历分享

外部查看者通过 token 匿名读取固化后的分享快照，因此分享函数需要允许请求到达函数内部校验逻辑：

```bash
supabase functions deploy resume-share --no-verify-jwt
```

`--no-verify-jwt` 只关闭 Supabase 网关统一 JWT 前置校验。函数内部仍会校验 token、链接状态、有效期和密码；涉及 owner 写操作时还会单独验证用户 JWT。

分享密码使用 Edge Runtime Web Crypto 的 PBKDF2-SHA256 处理。密码校验前存在按分享链接和客户端维度的持久化限流，匿名请求不会直接读取 `resume_shares` 表。

## 本地验证

启动开发服务器：

```bash
pnpm dev
```

至少验证以下路径：

1. 未登录时创建、编辑和刷新离线简历；
2. 登录、同步简历并在另一会话中重新加载；
3. 执行一次 ATS 分析或 AI 改写；
4. 创建指定版本的分享链接，并在匿名窗口中查看；
5. 在求职看板添加岗位并设置下一步跟进。

## 构建与部署

```bash
pnpm lint
pnpm build
pnpm preview
```

仓库中的 `vercel.json` 已包含单页应用 rewrite。部署到 Vercel 时，需要在项目环境变量中配置与 `.env.local` 相同的三个 `VITE_*` 变量，并将 `VITE_BASE_URL` 设置为生产域名。

其他静态托管平台同样需要把未知路径回退到 `index.html`，否则浏览器直接打开 `/resume`、`/share` 等路由会返回 404。

## 安全边界

- 不要把模型密钥、Supabase `service_role` 或其他服务端秘密写入 `VITE_*` 环境变量；
- `VITE_SUPABASE_PUBLISHABLE_KEY` 可以出现在浏览器中，数据访问安全依赖数据库 RLS；
- 匿名分享只通过 `resume-share` Edge Function 读取脱敏快照；
- 生产环境应使用 HTTPS，并为 Supabase Auth 配置正确的 Site URL 与 Redirect URLs。
