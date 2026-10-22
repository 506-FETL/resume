# 自托管指南

本指南用于部署 GResume 前端，并连接自己管理的 Supabase 项目。前端本地启动见 [README](../README.md#本地运行与自托管)；这里不包含整套 Supabase 平台的 Docker 部署。

## 前端配置与构建

使用 Node.js 24、pnpm 10.33.3，在项目根目录的 `.env.local` 中配置：

| 变量                                     | 说明                                  |
| ---------------------------------------- | ------------------------------------- |
| `VITE_SUPABASE_URL`                      | 必需，Supabase 项目 URL               |
| `VITE_SUPABASE_PUBLISHABLE_KEY`          | 必需，可公开的 publishable / anon key |
| `VITE_BASE_URL`                          | 站点基地址，用于认证回调和分享链接    |
| `VITE_RESUME_COMMENTS_FUNCTION_REGION`   | 可选，评论函数区域；未设置时自动解析  |
| `VITE_COLLABORATION_PROTOCOL_V2_ENABLED` | 可选，协作协议 v2 开关；当前默认关闭  |

`VITE_` 变量会写入浏览器构建产物，只能放公开配置。模型密钥、service role key 和评论签名密钥放在服务端。

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm preview
```

生产资源位于 `dist/`。静态托管需将前端路由回退到 `index.html`，仓库的 [`vercel.json`](../vercel.json) 已包含 Vercel 配置。环境变量在构建时生效，修改后需重新构建。

## 数据库与核心函数

准备 Supabase CLI 和目标项目。仓库已包含 [`supabase/config.toml`](../supabase/config.toml) 与[迁移](../supabase/migrations/)，无需重新初始化。CLI 用法参见官方[环境管理](https://supabase.com/docs/guides/deployment/managing-environments)和[函数部署](https://supabase.com/docs/guides/functions/deploy)文档。

### 1. 链接项目并应用迁移

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push --dry-run
supabase db push
supabase migration list
```

先确认项目和 dry-run 列表，再执行正式迁移；已有数据库还需核对远端迁移记录。

### 2. 设置服务端密钥

将以下配置写入已被 Git 忽略的 `supabase/functions/.env`，每个评论密钥使用不同的长随机值：

```dotenv
# 历史兼容变量名，值必须是 DeepSeek API key
OPENAI_API_KEY=your-deepseek-api-key
RESUME_COMMENT_TOKEN_SECRET=replace-with-a-long-random-secret
RESUME_COMMENT_COLLABORATOR_SECRET=replace-with-a-different-random-secret
RESUME_COMMENT_ANONYMOUS_PEPPER=replace-with-a-different-random-secret
RESUME_COMMENT_REALTIME_SECRET=replace-with-a-different-random-secret
```

```bash
supabase secrets set --env-file supabase/functions/.env
supabase secrets list
```

托管 Edge Functions 自动注入 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`。密钥管理参见 [Supabase 官方文档](https://supabase.com/docs/guides/functions/secrets)。不要提交真实环境文件或将密钥放入截图。

### 3. 部署核心函数

```bash
supabase functions deploy resume-share
supabase functions deploy resume-comments
supabase functions deploy llm-proxy
```

### 4. 配置认证回调并验收

在 Supabase Dashboard 的 **Authentication → URL Configuration** 中设置生产 Site URL，并将实际使用的完整路径加入 Redirect URLs：

- `<站点地址>/resume/editor`：编辑器认证回调。
- `<站点地址>/reset-password`：邮件找回密码。
- 本地调试时，按实际端口添加对应 `http://localhost:5173/...` 地址。

不要使用允许任意来源的通配符。密码恢复页要求有效恢复会话；PKCE 回调还需要发起流程的浏览器保有 verifier。普通登录状态不能直接通过恢复页改密码。

部署后用普通用户验证登录、密码恢复、简历保存、分享访问、评论与 AI 请求，并检查跨用户数据隔离。仅函数返回 200 或未登录请求被拒绝，不足以确认完整业务可用。

## 可选运维任务

GitHub stars 缓存和后端监控不影响核心编辑流程，需要时再部署：

```bash
supabase functions deploy github-stars-refresh
supabase functions deploy backend-ops-monitor
```

| Secret                                    | 用途                         |
| ----------------------------------------- | ---------------------------- |
| `BACKEND_MAINTENANCE_TOKEN`               | 后端维护调用鉴权，至少 32 位 |
| `GITHUB_TOKEN`                            | GitHub stars 缓存刷新        |
| `OPS_ALERT_WEBHOOK_URL`                   | 后端运维告警                 |
| `COLLABORATION_LEGACY_REGISTER_CUTOFF_AT` | 可选，旧协作注册流程截止时间 |

部署函数不会自动启用定时调用。开启前，将同一个维护令牌配置为 Edge secret 和 Vault secret，再设置项目 URL 与开关：

```bash
supabase secrets set BACKEND_MAINTENANCE_TOKEN=replace-with-the-same-long-random-token
```

```sql
select vault.create_secret(
  'https://your-project-ref.supabase.co',
  'resume_backend_project_url'
);
select vault.create_secret(
  'replace-with-the-same-long-random-token',
  'resume_backend_maintenance_token'
);
select private.set_backend_maintenance_flags_v1(true, true);
```

`cleanup_enabled` 与 `edge_jobs_enabled` 默认均为 `false`。不启用运维时保持默认；轮换凭据或重复配置时更新已有同名 Vault secret，不要重复创建。

仅需要显示并定时更新 GitHub Stars 时，在部署 `github-stars-refresh` 并配置上述维护令牌和 Vault 后，单独启用刷新即可，无需开启监控或清理任务：

```sql
update private.backend_maintenance_config
set github_stars_refresh_enabled = true, updated_at = now()
where singleton;
select private.invoke_backend_edge_job_v1('github-stars-refresh');
```

`github_stars_refresh_enabled` 默认也是 `false`。启用后沿用每 6 小时一次的刷新计划；首次刷新成功前，前端不会显示 Star 数量。原有 `edge_jobs_enabled` 开关仍可同时启用全部 Edge 运维任务。

## 开发验证

前端使用 `pnpm lint` 与 `pnpm build`。协作、AI、评论等专项脚本列在 [`package.json`](../package.json) 中，应按变更范围选择。

数据库合约位于 [`supabase/tests/database`](../supabase/tests/database/)。在已安装 Supabase CLI 和容器运行环境的本机执行：

```bash
supabase start
supabase db reset --local
supabase test db --local
```

`db reset --local` 会重建本地数据库。迁移与 Edge Function 修改还需完成对应的权限、并发和业务流程验证。
