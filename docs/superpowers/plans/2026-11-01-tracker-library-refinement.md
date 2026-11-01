# 求职进度、读取性能与页面布局修正计划

> 使用 subagent-driven-development 分派独立实现任务并审查；保持当前分支，不推送，不执行 TDD。用户已授权本期七项修复，完成实现与验证后交用户审查。

**目标：** 修正流程与统计含义，减少 JD 无关读取，改善桌面层级、滚动和评分背景，移除内置真实姓名。

**架构：** 沿用 tracker 工作流与 Zustand、Supabase 列授权和 RLS、页面已有组件。布局改变只在相关页面局部实现，不改公共模板打印或全局视觉体系。

**技术栈：** React、TypeScript、Zustand、Tailwind、Motion、shadcn/ui、Supabase。

## 任务与验证

- [x] 1. 视觉布局：修改 tracker/components/toolbar、share/index、resume/index、optimize/components/dashboard/overview-summary-card。工具栏按视图/管理与查询分层；内容容器使用 `flex-1 min-h-0 overflow-y-auto`，祖先有确定高度；页头保持 `shrink-0`。沿用已有控件与交互。实际查看 1440/1024/768/390/320px、深色、滚轮与键盘。
- [x] 2. JD 性能：修改 lib/supabase/resume/submissions 与 tracker 的 JD 读取资源。用 `.select('jd_text,jd_updated_at').eq('id', id).eq('user_id', user.id)` 代替 material 请求；复用现有账户代次与投递 revision。检查列授权，新增最小 grant 迁移时用 CLI 生成，先隔离验证权限，再部署 linked 云端并核对账本、函数版本、HTTP smoke。比较相同数据的字段数、字节数、请求数及耗时。
- [x] 3. 流程与统计：修改 tracker/workflow、utils、progress-timeline 及 stepper。依据已记录的访问与转换判断完成/跳过，已投递 metric 使用在办阶段集合；精确阶段筛选不变。直接调用真实函数验证跳级、终态、恢复及统计筛选一致，并在真实进度组件检查图标。
- [x] 4. 内置示例：扫描 src、public 及演示资源中的硬编码个人姓名和相关标识，替换为明确示例标签；自动生成资源修改源头后重生成。保留用户原有未提交改动的意图，不变更真实云端资料。
- [x] 5. 验收与复盘：改动文件依次运行 `pnpm exec prettier <files> --write`、`pnpm exec eslint <files> --fix --fix-type layout`；运行类型检查、lint 和 build。采用 review-animations 审查实际过渡。记录已实施、已验证、待用户审查，删除 tests 下本次临时验证脚本与数据，更新防回归清单。

## 组件检索

已找到 Button、Input、Tabs、Tooltip、Collapsible、CompanyPicker、FilterMenu、SortMenu、PageLayout、AnimatedContent 与 PresenceDiv；无须新增或手写替代控件。既有 Stepper 属于 ReUI 适配实现，继续局部修正状态图标。

## 交付状态

实施完成；类型检查、生产构建、全项目格式检查、数据库权限及线上读取、页面滚动与动效验证通过。独立审查通过，短屏问题已修复并复验。用户审查待进行。临时 tests 脚本与隔离数据库已清理；未提交或推送。详见[验收记录](../specs/2026-11-01-tracker-library-refinement-acceptance.md)。
