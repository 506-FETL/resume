# 简历全文评论验证记录

## 1. 结论

- 验证时间：2026-08-14 01:28–01:32 CST
- 验证分支：`feat/comment`
- 实现提交范围：`5a04e30` 至 `d966012`，相对 `upstream/feat/comment` 共 16 个提交
- Supabase CLI：2.111.0

当前结论是：实现与可在本机完成的静态、纯逻辑、Deno 类型和未登录浏览器回归已经完成，但全功能验收尚未完成，不能宣布“全部验证通过”。阻塞项包括：

- 本机没有 Docker 或 Podman，本地 Supabase 数据库无法启动，迁移、SQL 事务断言、DB lint 和 Edge HTTP 矩阵未实跑；
- `pnpm lint` 受仓库既有文档、示例和其他页面的全量 lint 基线影响失败；本功能定向文件 lint 通过；
- 当前浏览器没有登录账号，owner、匿名访客、登录访客、协作者和双窗口 Realtime 矩阵未在当前 HEAD 上实跑；
- 没有 iOS Safari 与 Android Chrome 真实设备，移动端交互状态为“未验证”。

## 2. 命令证据

| 命令                                                           | Exit code | 结果与关键输出                                                                                            |
| -------------------------------------------------------------- | --------: | --------------------------------------------------------------------------------------------------------- |
| `pnpm verify:comments`                                         |         0 | `resume comment anchor verification passed`                                                               |
| `pnpm verify:comment-client`                                   |         0 | `resume comment client verification passed`                                                               |
| `pnpm verify:comment-service`                                  |         0 | `resume comment service verification passed`；包含协作者签名角色篡改拒绝断言                              |
| `pnpm exec tsc --noEmit --pretty false`                        |         0 | 无 TypeScript 错误                                                                                        |
| 评论、协作、编辑器与 Edge Function 定向 ESLint                 |         0 | 定向文件无错误                                                                                            |
| `pnpm lint`                                                    |         1 | 全仓共 1856 errors、12 warnings；主要来自既有 superpowers 文档、demo/示例和任务外页面，未批量改写这些文件 |
| `pnpm build`                                                   |         0 | Vite 生产构建成功，5691 modules transformed；仅有既有 chunk size warning                                  |
| `deno check`（评论 shared、`resume-comments`、`resume-share`） |         0 | 五个 Edge/共享模块均通过 Deno 类型检查                                                                    |
| `git diff --check`                                             |         0 | 当前工作树无空白错误                                                                                      |
| `supabase status`                                              |         1 | Docker 和 Podman 均不可用；未连接或修改远端数据库                                                         |
| `supabase db reset`、SQL 脚本、`supabase db lint --local`      |    未运行 | 依赖本地容器环境，不能用 SQL 静态内容替代实际执行                                                         |

## 3. 浏览器证据

本轮使用本地 Vite `http://127.0.0.1:5176`，浏览器测试结束后已关闭临时标签页和开发服务器。

| 场景                             | 结果                                                                                                | 边界                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 未登录 `/resume/editor`          | 页面稳定渲染；评论按钮禁用；控制台无 error                                                          | 没有 owner 登录态，不能验证写入和 Drawer                   |
| 无效 `/share/view/invalid-token` | 显示“链接不可用”；无 `Maximum update depth exceeded`                                                | 只覆盖公开错误边界                                         |
| 767 / 768 / 769 px               | 每个宽度都只有 1 个评论入口；无 React 深度错误                                                      | 入口禁用，不能替代移动/桌面实际交互                        |
| 离线简历                         | 本次实现阶段较早的真实浏览器回归已确认入口禁用且提示“离线简历不能评论”                              | 当前 HEAD 未重新创建临时离线简历；未检查网络面板           |
| 已登录在线编辑器                 | 实现阶段较早曾复现并修复 Zustand selector 导致的 `Maximum update depth`，修复后页面和评论面板可打开 | 当前 HEAD 新增协作者权限后没有可用登录态，不能视为最终 E2E |

以下桌面矩阵未验证：真实创建/回复/编辑/删除、右侧 Drawer 当前 HEAD 交互、history 与两个 share 隔离、republish、archive、匿名与登录访客、collaborator、双窗口 Realtime、断网恢复、重叠线程、detached/relink、密码分享、自定义模板和真实打印/PDF。

## 4. 移动设备记录

| 设备          | 系统   | 浏览器         | 结果   |
| ------------- | ------ | -------------- | ------ |
| iPhone / iPad | 未提供 | iOS Safari     | 未验证 |
| Android 手机  | 未提供 | Android Chrome | 未验证 |

桌面浏览器的 767 px 响应式检查只证明入口没有重复渲染，不等价于原生长按选区、软键盘、安全区、底部操作条和底部 Drawer 的真实设备验收。

## 5. 安全与隐私审计

已完成静态审计：

- 匿名身份只持久化 `secret_hash`，不持久化 secret 原文；
- 客户端地址进入限流前先加 pepper 哈希，表中不保存原始 IP；
- 分享访问的 `accessibleScopes` 始终为空，只有 owner 分支加载私有版本列表；
- Realtime 只广播 `eventSeq` 和 `type`，不广播正文、匿名凭证或私有版本信息；
- 评论、协作会话和成员表对 `PUBLIC`、`anon`、`authenticated` 全部撤销，只给 `service_role`；
- 协作者角色由服务端会话记录决定，token 同时绑定 session、resume、working scope、user 和 role；host lease 防止旧页面误撤销刷新后恢复的会话；
- 分享 token 绑定 current release 和密码世代，旧 release 返回 `stale_release`；
- 正文由 React 文本节点渲染，没有 `dangerouslySetInnerHTML`；链接只识别 `http`、`https` 和 `mailto`；
- 所有评论浮层都有 `data-resume-comment-ui`，打印媒体样式强制隐藏。

尚未完成的动态安全验证：真实数据库权限、旧 token HTTP 请求、限流窗口、匿名 secret 生命周期、host stop 后旧协作者 token 和跨 resume token 的接口请求。

## 6. 18 条验收清单

“静态/纯逻辑通过”不等于“真实交互通过”。

|   # | 状态     | 证据或缺口                                                           |
| --: | -------- | -------------------------------------------------------------------- |
|   1 | 部分通过 | 编辑页与分享页均已挂载 Surface；未真实写入两端评论                   |
|   2 | 部分通过 | 跨语义块拒绝的纯逻辑通过；当前 HEAD 的提示交互未验证                 |
|   3 | 部分通过 | 桌面右侧 Drawer、移动底部 Drawer 已实现；真实设备未验证              |
|   4 | 部分通过 | 全局入口、筛选、高亮与未读状态已实现并有纯逻辑覆盖；未做完整交互矩阵 |
|   5 | 部分通过 | 选区重叠与复用算法通过；未真实创建重叠线程                           |
|   6 | 部分通过 | 权限与 tombstone 事务已实现；SQL 和浏览器未实跑                      |
|   7 | 部分通过 | Unicode 与重定位脚本通过；未在在线简历制造 detached/relink           |
|   8 | 部分通过 | history 独立 scope 已实现；数据库与浏览器隔离未实跑                  |
|   9 | 部分通过 | share/release 唯一 scope 与 token 绑定已实现；数据库与浏览器未实跑   |
|  10 | 部分通过 | stale release 和 owner review 路径已实现；未真实 republish           |
|  11 | 部分通过 | history 删除 RPC 与级联约束已实现；SQL 未实跑                        |
|  12 | 部分通过 | owner/visitor/anonymous/collaborator 权限静态覆盖；多身份 E2E 未实跑 |
|  13 | 部分通过 | `allow_comments` 只读链路已实现；公开页面动态切换未实跑              |
|  14 | 部分通过 | 离线恢复、序号缺口和幂等脚本通过；真实断网/双窗口未实跑              |
|  15 | 部分通过 | 纯文本、协议白名单、签名与限流代码通过；数据库限流未实跑             |
|  16 | 部分通过 | 归档和永久删除路径已实现；级联行为未实跑                             |
|  17 | 部分通过 | 打印 DOM 隔离和 CSS 已静态确认；未打开真实打印预览/PDF               |
|  18 | 部分通过 | 离线入口禁用已浏览器确认；无评论请求和转在线空 scope 未验证          |

## 7. 发布顺序

1. 先部署数据库迁移 `20260813000001`、`20260813000002`、`20260813000003`；
2. 再部署 `resume-share` 与 `resume-comments` 两个 Edge Function，并配置评论 HMAC/pepper secret；
3. 最后部署前端；
4. 上线前在隔离 Supabase 项目补跑本文件缺失的 DB、HTTP、身份和 Realtime 矩阵。

数据库迁移必须先于 Edge Function 和前端，否则新 release/scope、协作成员表与事务 RPC 不存在会导致评论服务失败。

## 8. 回滚边界

- 旧 `resume_shares.snapshot`、`template_manifest` 和来源列仍保留，可回滚前端读取链路；
- 不要回滚或删除已经产生 release/comment 数据的迁移；前端回滚不应伴随数据表回滚；
- 若 Edge Function 出现问题，先回滚 Edge 与前端并关闭入口，保留已写入的数据；
- 正式清理旧 snapshot 列必须另开规格、迁移和生产数据核验；
- 不对不同 scope 迁移评论，不合并匿名身份，也不自动通知外部用户。

## 9. 提交边界

- 实现提交在加入本验证记录前，相对 `upstream/feat/comment` 为 125 files changed、14822 insertions、356 deletions；
- 未提交 `.env`、本地 Supabase 数据、匿名 secret、截图、设备标识或 `.superpowers/brainstorm/`；
- 当前工作树仍有 6 组用户原有未提交修改：`comment-surface.tsx` 与 5 个旧迁移文件，本功能提交没有吸收这些改动；
- 未执行 `git push`。

## 10. 完成剩余验收所需环境

1. 安装并启动 Docker Desktop 或 Podman，运行 DB reset、SQL 脚本和 DB lint；
2. 准备 owner、登录 visitor、collaborator 三个隔离账号和两个浏览器窗口；
3. 准备 iOS Safari 与 Android Chrome 真机；
4. 使用隔离分享和测试简历完成桌面/移动矩阵，并清理测试数据；
5. 修复或重新定义全仓 lint 基线后再要求 `pnpm lint` 为零。
