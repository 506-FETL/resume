# 分享联系方式占位验收

日期：2026-11-11。用户明确授权在前述创建、搜索与浮层修复后处理。代码已实施并部署，接口验证通过，浏览器及最终 PDF 验收尚未完成；用户审查待进行。

## 改动

生产仅修改 `supabase/functions/shared/resume-share-privacy.ts` 的显式联系方式分支：非空字符串在隐藏时变为七个大写 X，空或仅空白的值仍为空。原有字段别名、正文/标题/链接的重复原值清洗、`canReadShareComments` 及每次请求的权限复查保持。保存正文和历史快照没有改写。模板、分页和 PDF 引擎没有变化。

现有 content_revision 对公开 snapshot 计算哈希，空值改为占位后自然产生新修订；没有增加无必要的缓存版本常量。

## 验证

主代理复跑真实源码的 11 项 Node 检查，全部通过：四种显隐组合、空值、旧别名与大小写、重复正文/标题/链接、模式清洗、输入对象不变、公开展示评论限制、真实内容哈希变化。

线上最终轮 13 组通过：

- current/history 原始公开值正确，匿名评论 bootstrap 初始返回 200。
- 两种来源分别覆盖四种电话/邮箱组合；隐藏项显示 `XXXXXXX`，公开响应及标题没有对应真实值；重复富文本不产生掩码联系方式链接。
- 策略切换返回新 snapshot，相同 revision 返回 not_modified 并省略 snapshot；两种来源传旧空字段投影的 revision 均能取得新占位快照。
- 六次旧评论凭据在隐藏联系方式后返回 404 / share_unavailable；未因保留占位而开放评论或附件。
- 所有者配置与冻结版本保持原文；保存后 current 更新、history 固定；原空字段保持空。

前两轮是临时脚本问题，未记为通过：AFTER INSERT 触发器更新 current_version_id 后，INSERT RETURNING 仍为旧 null，脚本改为按本轮 ID 重读；匿名评论错误携带 legacy anon Bearer，被真实鉴权拒绝，按正式匿名协议省略 Authorization 后继续。没有修改生产认证或触发器。三轮合成账号均已删除，配置、版本、评论范围、分享及发布批次逐轮核对为零，Auth 查询均为 404。

## 部署与工程检查

通过当前项目 CLI 部署 resume-share，随后核实 ACTIVE v48，verify_jwt 保持既有 false；resume-comments 保持 v46。所有最终轮 Edge 响应的 x-sb-edge-region 为 us-east-1。没有数据库迁移。

本机缓存 Deno 2.9.5 / TypeScript 6.0.3 对未修改的密码 salt 和签名参数报两处 WebCrypto BufferSource 类型错误；该命令失败没有记为通过，也没有扩大修改密码代码。独立 privacy 文件检查通过，随后用 Deno 2.1.4 对完整原 handler 执行 check --no-lock，退出码 0。该兼容线依据 [Supabase Deno 2.1 公告](https://github.com/orgs/supabase/discussions/37941)；线上实际行为另由上述 smoke 核实。

前端最终 TypeScript 检查与生产构建退出码 0；生产构建 16.82 秒，原有大于 500kB 分包提示保留，没有提高阈值。全项目 format:check 退出 0，ESLint 0 errors、68 条既有 warnings，Prettier 全部通过；git diff --check 通过。主代理另查云端两个本轮 test_purpose 标记的剩余账号数为 0。

## 页面验收阻塞与清理

浏览器工具持续连接超时，读取标签页、新建页面及重置后连接均失败，已请求重开 Codex 浏览器面板。最新背景版、搜索余项和本项分享/PDF 的实际页面检查均没有冒充通过。

线上合成数据、任务数据库容器/网络及临时云端凭据已清理。已完成的历史/跟进/浮层和数据库临时材料已删除；`tests/resume-workflow` 与分页夹具中仍需补页面验收的内容暂留，待连接恢复完成验收后按仓库约定全部删除。原有 5173 服务保留，5193 是本轮分页验收服务。

- 实施：完成。
- 接口与数据验证：通过。
- 浏览器与 PDF 验证：受连接故障阻塞。
- 用户审查：待进行。
