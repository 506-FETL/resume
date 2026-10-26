# 编辑检查反馈与布局修正实现计划

> **面向 AI 代理的工作者：** 使用 executing-plans 逐项执行。用户已明确授权九项修正；沿用当前分支，无需另行确认设计，不提交或推送。

**目标：** 让检查颜色、定位状态、字段反馈和紧凑布局保持一致。

**架构：** 编辑页集中严重程度呈现配置，通用 Form 接收可选反馈上下文，页面业务组件负责稳定路径映射。预览通过实际面板可见性与检查状态共同控制高亮。现有 shadcn Tabs 根节点包含操作头部，使切换可放入保存操作行。

**技术栈：** React、Zustand、shadcn/Radix、Magic UI、Motion、Tailwind。

---

- [x] 1. 将 check-panel/const.ts 的等级配置移至 utils/check-presentation.ts；添加最高未处理严重程度与字段路径映射。用 `['error', 'warning', 'suggestion'].find(...)` 确保优先级，不把已处理问题计入。
- [x] 2. 扩展 src/components/ui/form.tsx 的可选 FormFeedbackProvider；新增 editor/components/check-fields/index.tsx 将同模块稳定目标映射到 `items.0.field`，日期同时匹配父字段。FormLabel/输入边框显示等级，说明通过 aria-describedby 提供。桌面 SectionRow、手机 FIELD_ITEMS 统一包裹。
- [x] 3. 改造 check-workspace/index.tsx 支持 header，拆出同目录 mode-toggle.tsx，使用现有 TabsList/TabsTrigger 和共享 layout 动画。CollaborationControls 新增 actions 插槽；去掉独立 tab 行和 editingIssueId 提示行，接入桌面和手机。
- [x] 4. SiteHeader 只在编辑页改为对称三列布局，移除面包屑；toolbar 和 Preparation 使用手机图标按钮及明确名称。检查按钮和切换采用同一最高等级颜色。
- [x] 5. 预览接收实际面板打开状态，CheckHighlight 判断 `enabled && tab === 'checks'` 及当前筛选；颜色复用统一配置，退出使用短淡出。手机删除关闭抽屉后继续定位的入口，仍可在检查条目查看原文与前往修改。
- [x] 6. SectionRow 移除 overscroll-contain；导出分开显示错误、待核对、建议摘要并着色，保留 AI 提示和错误红色直接导出逻辑。
- [x] 7. 用 tests/editor-check-feedback 下的临时离线 fixture 和 Playwright 覆盖规格中的浏览器验收；不接触用户云端数据。修复失败后再验收。对改动文件运行 Prettier、ESLint layout；执行 `pnpm exec tsc --noEmit -p tsconfig.app.json`、`pnpm build` 和 `pnpm format:check`，删除临时脚本。补充 guardrails 和验收结果。

## 输入性能补充

- [x] 将 useResumeChecks/useCheckLayout 移到独立 CheckRuntime，避免检查订阅驱动整个页面。输入使用已有 useDebouncedValue 等待 250 ms；以快照、证据、处理记录和检查版本缓存文字规则结果。排版结果只合并，不重复执行文字规则；相同结果复用引用。
- [x] ExportDialog 仅在 open 时计算摘要；真实导出仍取最新快照。CheckWorkspace 仅订阅 tab；确认问题前重新校验当前正文，防止防抖期间确认旧内容。
- [x] 在 tests/editor-check-feedback 采样同一输入场景，比较检查次数、HTML 解析和长任务；回归标记更新、即时导出、跨简历隔离，再执行类型、格式与构建检查。

## 验收记录（2026-10-26）

临时浏览器环境使用独立 Chrome 上下文、离线简历和合成内容，未修改用户简历。35 项浏览器检查通过，临时脚本和导出文件在完成后清理。

- 桌面、320/375/390/768/900/1280 px 布局：编辑页面包屑隐藏、工具栏居中、手机图标化、操作行切换紧凑，无横向溢出或页头覆盖正文。
- 红/黄/蓝/无问题四态：入口、tab、字段、导出摘要一致；日期、富文本、跨模块同词、同字段多个等级及经历重排正确；缺失公司名称不误标正文。
- 高亮连续两轮切换与快速反向切换，关闭面板、切换填写、收起条目和筛选后清除；深色与减少动效覆盖。普通表单未被误标，无页面异常及焦点隐藏警告。
- 真实鼠标滚轮触底后继续带动外层列表；修正邮箱后标记自动清除。
- 实际 Word 下载通过；PDF 从真实入口完成字体与分页签名验证后，捕获打印副本并生成文件，检查标记未进入打印内容。本次未修改模板、分页或公共打印样式。
- 错误仍可直接导出；确认后只剩待核对时恢复默认按钮。输入后立即打开导出显示最新错误；防抖期间不能确认旧内容；正文修改后 AI 校对立即过期；等待期间切换简历不串入旧结果。

性能对比使用相同的六条经历与连续 20 字符输入（加首次填值，共 21 次内容变化）：

| 观察项           |    修复前 |   修复后 |
| ---------------- | --------: | -------: |
| 检查结果数组更新 |     43 次 |     1 次 |
| DOMParser 调用   | 10,169 次 | 1,203 次 |

样本来自开发环境及带采样探针的浏览器，调用次数说明重复工作减少，不作为生产环境延迟承诺。剩余解析主要来自现有预览及评论处理；未为降低数字而关闭预览或删减检查。

最终静态验证：`pnpm exec tsc --noEmit -p tsconfig.app.json`、`pnpm build`、`pnpm format:check` 均通过；ESLint 为 0 错误，保留仓库原有 73 条警告。构建保留已有循环 chunk 与大包提示。改动文件已执行 Prettier 和 ESLint layout 修复，`git diff --check` 通过；临时 `tests/editor-check-feedback/` 及空目录已删除。
