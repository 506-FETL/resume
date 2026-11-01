# 个人应用层级与辨识度实现计划

> 面向 AI 代理的工作者：按 dispatching-parallel-agents 分派三个互不重叠的页面；主代理统一集成、实页验收和交付。用户已授权实施；当前分支工作，不提交、不推送，不执行 TDD。

**目标：** 让简历、分享与优化拥有明确的内容焦点和不同构图，首页保持原样。

**架构：** 只调整各页面呈现及局部查看状态。复用现有真实缩略图、shadcn 控件、Zustand 数据和公共动效。不修改数据入口及业务行为。

**技术栈：** React、TypeScript、Tailwind、shadcn/ui、Motion、Zustand。

## 任务

- [x] 简历库：修改 src/pages/resume/index.tsx、components/resume-card/index.tsx 及必要的同页预览组合。最近文档与其余文档互斥展示，所有筛选及操作保留，单个预览懒加载；同步 skeleton。只复用首页缩略图，不修改首页目录或共享类型色。
- [x] 分享：修改 src/pages/share/components/grid/index.tsx、card/index.tsx、content/index.tsx 及必要的局部类型。用 Map 按 resume_id 保持首次出现顺序分组；章节标题与链接目的分层，过滤不改变。同步 skeleton，保留菜单焦点交接。
- [x] 优化：修改 src/pages/optimize/components/dashboard/overview-summary-card.tsx、analysis/index.tsx、analysis/finding-item.tsx 及必要的页面布局。按 high → medium → low 和 isAtsFindingPending 选首个待处理项，仅它默认展开；报告变化重置查看状态，用户手动折叠保留直到报告切换。保留评分水印与真实建议操作。
- [x] 在 tests/personal-app-character/ 建隔离样本，挂载正式页面及 providers，覆盖预览、分组与报告；不接触真实账户。浏览器检查桌面、窄屏、中间宽度、深色和状态，以及重复开关和焦点。
- [x] 对改动文件先 pnpm exec prettier --write，再 pnpm exec eslint --fix --fix-type layout；运行 pnpm exec tsc -b --pretty false、pnpm build、pnpm format:check 和 git diff --check。
- [x] 更新设计与验收记录，标记上一轮视觉审查未通过。删除临时 tests 样本，保留证据。实施完成、验证通过、用户审查分别记录。

## 组件检索结论

现有 Button、Badge、Tabs、Collapsible、Skeleton、Dialog、DropdownMenu 足够；纸张预览已有 ResumeThumbnail。章节与列布局为原生语义结构，无需新增控件库。各页业务动作保留原实现。
