# 编辑检查与导出体验实施计划

> 面向 AI 代理的工作者：使用 subagent-driven-development 执行独立任务，集成后进行规格与代码审查。当前分支开发，不 commit、不 push；不强制 TDD。用户已经授权，完成后交付审查。

**目标：** 实现已确认的编辑侧栏检查与简短导出摘要。

**架构：** 检查类型与规则放在 src/lib/resume-checks；页面 store 保存检查状态和导航，单个 runtime 连接正文、来源记录与 AI 校对。预览高亮使用独立覆盖层，复用 Magic UI Highlighter；导出消费同一份检查结果并守卫实时快照。

**技术栈：** React、Zustand、shadcn/Radix、Magic UI、现有 LLM 代理与 IndexedDB。

## 文件与职责

- src/lib/resume-checks/types.ts：共同问题、目标和结果协议。
- src/lib/resume-checks/rules.ts、dates.ts、terms.ts、targets.ts：本地规则、稳定字段定位及安全替换。
- src/lib/resume-checks/proofread.ts：既有 LLM 服务的只读文字校对及返回校验。
- src/pages/resume/editor/store/checks.ts：结果、侧栏模式、筛选和选择状态。
- src/pages/resume/editor/hooks/use-resume-checks.ts：单次挂载的检查 runtime、取消与身份守卫、确认与修改。
- src/pages/resume/editor/components/check-panel/index.tsx：紧凑检查列表与操作。
- src/pages/resume/editor/components/check-highlight/index.tsx：预览原文覆盖层。
- 编辑器、EditPanel、toolbar、移动端 Drawer：侧栏接入与焦点交接。
- src/pages/resume/editor/components/export/index.tsx：短摘要、错误时红色按钮、真实导出。

## 任务 1：检查协议与规则

- [x] 定义统一问题协议；目标用 section、path、quote，条目路径使用 entryId。
- [x] 实现日期与联系方式校验、常见术语和错字、示例分组、AI 来源汇总；隐藏内容不检查。
- [x] 原文签名对应的保留记录生效；纯文本与富文本安全替换不破坏结构，日期不自动修复。
- [x] tests/resume-checks 中验证非法日期、合法范围、大小写边界、重排、隐藏、重复、富文本与陈旧替换。

## 任务 2：文字校对

- [x] 调用现有 callLLM，发送可见字段白名单；不给模型写入工具。
- [x] 返回必须匹配字段身份与原文，限制数量、长度，所有模型建议为 warning；不接纳岗位匹配或职责改写。
- [x] 验证畸形 JSON、注入文字、伪造字段、原文不匹配、取消和超长输入。

## 任务 3：运行状态与侧栏

- [x] 页面 store/runtime 对齐共享结果，正文变化时重新算规则，AI 结果过期明确提示；请求按账户、简历和签名守卫。
- [x] 使用 Tabs 与 Accordion 接入桌面编辑栏和移动抽屉，保留滚动位置与编辑草稿，平滑切换，操作不抢输入焦点。
- [x] 实现定位、采用、保留与撤销；原文已变时停止写入。定位不到时说明并打开所属模块。
- [x] 用 DOM Range 测量可见预览文字，覆盖层渲染 Highlighter，不改源 DOM。缩放、滚动和分页后重新测量。

## 任务 4：导出摘要

- [x] 只列汇总与入口，删除旧理由表单；明确错误时导出按钮标红并允许直接导出，不额外确认。
- [x] 点击时使用最新快照；来源与 AI 失败不伪装成功、不阻止文件生成。
- [x] 保留真实 PDF / Word 的准备状态、关闭与焦点恢复。

## 任务 5：集成与验收

- [x] 改动文件运行 pnpm exec prettier --write，再运行 pnpm exec eslint --fix --fix-type layout；pnpm exec tsc --noEmit 和 pnpm build 通过。
- [x] 在独立浏览器数据中验收侧栏切换、手机、深浅色、长内容、采用/撤销/保留、旧结果失效、导出两轮开关及反向操作。
- [x] 通过真实导出入口检查 PDF 与 Word，检查不含定位笔触与 UI、原文未丢失。
- [x] 完成独立审查，修复问题，删除 tests/ 临时脚本，更新本计划与路线图的实现/验证状态。

## 验收记录（2026-10-26）

已完成实现，待用户审查。本轮不启动第三期，第四期 P4-05 的表达与岗位分析继续保留在后续排期。

- 本地规则 109 项通过：日期精度、非法日期、时间重叠、联系方式、术语边界、隐藏内容、条目重排、示例分组、签名失效与富文本补丁安全。
- 文字校对 21 项模拟验证通过：只发送可见字段，原文和返回协议校验，取消、超时、失败，以及“前端/后端”“本科/专科”“product/project”不可一键误改。未调用真实模型、未消耗用户额度。
- 导出摘要 16 项通过：有错误时红色按钮直接导出；仅提醒时原样式；来源或校对失败不阻止导出；文件准备状态、重复开关、退出中重开、手机布局和焦点恢复。
- 整页与边界交互 16 项通过：填写/检查切换宽度稳定，采用、撤销、保留、字段聚焦；多段及跨页原文定位，90 处重复词的末处定位；深色主题、减少动效下的指定高亮和手机跨模块跳转。未出现运行异常或 aria-hidden 焦点告警。
- 真实 Word 入口生成文件并核对正文。真实 PDF 入口通过字体、分页签名校验，从实际打印副本生成 PDF 后回读中文、日期和术语，确认不含检查界面或高亮。
- 独立审查发现并修复五处问题：AI 事实改写、命令大小写误报、多段换行定位、手机旧模块抢焦点、富文本跳转误选工具栏。额外修正了跨简历的检查打开请求和进入历史预览时取消校对。
- TypeScript 与生产构建通过；构建仍提示部分现有依赖分包超过 500 kB，没有新增依赖。改动文件完成 Prettier、ESLint layout 修复与检查。
- 全仓 `pnpm format:check` 通过：0 个错误，73 个既有警告均位于本轮未修改的文件；Prettier 全部通过。临时脚本、隔离测试数据与生成文件已清理。

检查范围保持保守：未知专名不判定为拼写错误；代码混合字段可能跳过术语检测；排版只在配置或实际渲染有证据时提醒，不保证检测所有错字或机筛兼容性。
