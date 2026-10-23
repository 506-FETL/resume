# 基本信息与编辑间距修复计划

**目标：** 用户填写的基本信息完整进入所有模板预览与导出，编辑区字段间距一致。

**架构：** 共用评论正文投影作为唯一文本来源，内容适配器保留字段语义，模板渲染前补全未覆盖信息。表单复用公共间距及容器断点。

**技术栈：** React、TypeScript、Zustand、声明式模板、Supabase Edge Functions、Playwright、Chrome PDF。

## 执行步骤

- [x] 保存修复前证据：投影缺少政治面貌、婚姻状况及自定义字段；记录教育表单学历控件与描述标签间距。
- [x] 修改 `supabase/functions/shared/resume-comment-core.ts`，投影条件为非空且不是“不填”；自定义字段使用 `customFields.<index>` 键，投影保存值、适配器保存标签，避免模板重复添加标签。
- [x] 修改 `src/lib/resume-template/content/adapt-profile.ts`，添加新增字段并从相同投影节点取文本。
- [x] 新建 `src/lib/resume-template/declarative/complete-profile-fields.ts`，遍历实际区域、条件和列表，计算未展示字段；在 `declarative-renderer.tsx` 的 repeat 处复用补齐列表。
- [x] 修改 `ResumeFieldFormSection` 条目正文为 `flex min-w-0 flex-col gap-4`；移除实习描述单独的 `mt-4`。修改各经历日期行的容器响应式换行；自定义字段、技能、证书网格按可用宽度排版。
- [x] 在 `tests/resume-profile-fields/` 运行临时验证：所有云端模板各字段恰好展示一次，空值不显示、自定义标签不重复，政治面貌及自定义字段编辑/刷新/切换模板正常；桌面、窄侧栏、移动端无横向溢出。
- [x] 运行改动文件 ESLint、`pnpm exec tsc -b --pretty false`、`pnpm build`。
- [x] 通过真实导出入口生成代表模板短、临界和多页 PDF，背景开/关均核对新增字段、全部条目和图像。
- [x] 对比线上函数依赖，部署受影响的 `resume-comments`、`resume-share`，核对函数版本和迁移账本；执行无业务数据写入的线上 smoke，并核对部署内容一致性。
- [x] 更新验收记录，删除临时验证脚本，保持当前分支，不执行 git commit 或 push。

## 验收记录

### 内容与编辑区

- 修复前已用直接投影复现：非空政治面貌、婚姻状况和自定义字段均未生成正文节点。
- 浏览器回归当前 62 套已发布模板，逐一检查新增字段与原有基本信息均只展示一次；重复自定义标签可并存，空值不显示。
- 通过真实表单将政治面貌改为“共青团员”、修改自定义值，等待自动保存并刷新后，预览仍显示修改后的内容。验收使用独立浏览器上下文中的本地简历。
- 教育模块学历控件与描述标签之间的实测间距为 16px；共用字段容器覆盖教育、工作、项目、实习、校园经历。日期行、自定义字段、技能、证书与爱好已按编辑面板宽度调整。
- 桌面 1440px 与移动端 390px 完成检查；移动表单宽度和滚动宽度均为 292px，无横向溢出，浏览器运行时错误为 0。
- 边界回归通过：`sections.present` 条件与区域路由一致；政治面貌、婚姻状况可以显式纳入 `fieldKeys`；标签映射为空时不误判为已显示标签。

### PDF 与静态检查

- 从编辑器“导出 → 导出 PDF”真实入口执行打印准备与签名校验，在校验通过后截获打印副本，使用 Chrome 输出背景图形关闭和开启的 PDF。
- 默认模板、经典蓝金模板、深蓝侧栏分别覆盖短内容、单页临界内容与多页长内容，共 18 份 PDF、32 页。

| 模板 | 短内容 | 临界内容 | 长内容 |
| --- | --- | --- | --- |
| 默认模板 | 1 页 | 1 页 | 3 页 |
| 经典蓝金模板 | 1 页 | 1 页 | 3 页 |
| 深蓝侧栏 | 1 页 | 1 页 | 4 页 |

- 核对全部标记、段落、新增字段、文字边界、空白页与背景开关栅格差异；人工检查代表页面。没有更改测量尺寸、打印样式或放宽分页校验。
- 改动文件 ESLint 无错误，类型检查与生产构建通过。保留既有数组索引 key 警告、循环分包与大 chunk 构建提示，不属于本次修改。

### 云端同步

- 已链接项目 `bitxrpdtlohlnywgusfw`：`resume-comments` 从 40 更新至 41，`resume-share` 从 41 更新至 42，状态均为 `ACTIVE`，保留函数内部鉴权及原有 `verify_jwt: false`。
- 部署前后逐文件对比：业务代码仅更新共享正文投影。部署工具沿用了失效的历史 import map 路径，发布包显式附带空 imports 的 `deno.json` 并指定路径后部署成功；无需更改已有 URL 依赖。
- 重新下载部署文件，两个函数的共享投影都与本地完全一致。
- 线上无业务数据写入 smoke：两个 OPTIONS 返回 200；缺失分享令牌、未知评论操作返回 404；未认证的分享设置、评论 owner bootstrap 返回 401；CORS 响应正常。
- 迁移账本前后相同，共 55 条，最后一条为 `20261022164611 page_region_resume_templates`。本次没有数据库迁移。
- 检查了云端日志和 advisories；没有修改数据库权限、索引或鉴权策略。既有提醒包括 [SECURITY DEFINER 调用检查](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)、[泄露密码保护](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)、[RLS 策略调用优化](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select)，与本轮正文投影无关。

临时验收证据存放于 `/tmp/resume-profile-fields-wWKitR`；临时脚本完成后从仓库移除。未执行提交或推送。
