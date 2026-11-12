# 工作台骨架连续性实现计划

> 面向 AI 代理：按既有分工在当前分支内联执行，用户已授权直接实施并最后审查。遵循仓库不使用 TDD、不新增分支、不 commit 或 push 的约束。

**目标：** 路由分包与首次数据读取显示同一套真实布局骨架，已有内容刷新不被替换。

**架构：** 页面骨架提取为只依赖现有 UI 和轻量常量的组件。`RouteSkeleton` 仅分派，正式页面的初始数据分支复用相同局部组件；保留各异步模块独立完成与原有权限门禁。

**技术栈：** React、TypeScript、现有 shadcn/ui Skeleton、Tailwind、Motion、Zustand。

## 文件职责

- `src/components/route-skeleton/index.tsx`：路由骨架分派，不承载通用大灰块。
- `src/components/page-skeletons/`：按页面组织的轻量骨架，供路由和真实数据分支共用。
- `src/pages/history/components/` 与 `src/pages/history/index.tsx`：统一候选和正文读取的时间线、详情骨架，保持刷新内容。
- `src/pages/optimize/components/`：开放式报告局部骨架与刷新显示条件。
- 首页、模板、分享、求职、助手和资料页的现有骨架调用：提取或复用正式结构。
- `tests/page-skeleton-continuity/`：仅本轮使用的浏览器夹具与结果，结束删除。
- `docs/superpowers/specs/2026-11-12-page-skeleton-continuity-acceptance.md`：记录真实覆盖、限制和防回归建议。

## 任务 1：统一历史与优化骨架

- [x] 提取历史候选读取、时间线、详情为同源轻量骨架，纸张使用 `PaperSkeleton`；已知版本记录标题保留。
- [x] 路由与历史页面使用同一工作区容器类：`grid-rows-[minmax(0,1fr)]` 和 `@min-[900px]/workspace:grid-cols-[clamp(16rem,23%,20rem)_minmax(0,1fr)]`。
- [x] 提取优化评分、问题分析和修复清单骨架；报告初次读取使用 `loading && !currentAtsConfig`，同目标报告刷新继续显示旧结果。
- [x] 保留历史 `currentResume` 与版本条目刷新展示，不改 store 的账户和目标失效。

## 任务 2：覆盖其余工作台路由

- [x] 按正式布局逐页对齐首页、模板、分享、求职、个人资料和助手，复用现有局部骨架，不再回退通用内容卡片。
- [x] 编辑器默认骨架使用真实预览容器，不预留未打开的右侧编辑栏；保留真实文档初始化和按需加载边界。
- [x] 核对嵌套 Suspense，避免重复侧栏或二次整页占位；简历库保留既有共用条目骨架和固定页脚。
- [x] 扫描新共享骨架 import，确认没有页面 store、编辑器或模板运行时。

## 任务 3：验证与收尾

- [x] 对修改 TS/TSX 文件执行 `pnpm exec prettier <files> --write`，再 `pnpm exec eslint <files> --fix --fix-type layout`。
- [x] 执行 `pnpm exec tsc --noEmit -p tsconfig.app.json`，预期 exit 0。
- [x] 独立 Playwright 浏览器挂载正式路由和页面，分别延迟分包与数据，比较骨架布局；覆盖优化、历史、模板及其他主要工作台首屏。
- [x] 核验已有报告/历史刷新、失败、空态、窄屏和动态减少动效；记录未覆盖链路，不触发真实模型或写入。
- [x] 写入独立验收记录，删除 `tests/page-skeleton-continuity/`，将修改清单与主代理统一构建所需信息交回。

## 组件检索

已有 `Skeleton`、`PaperSkeleton`、`LoadingRegion`、`ResumeLibrarySkeleton`、页面局部骨架、`PageLayout`、Button、Card 足够。本轮只组合与提取这些组件，不自建表单控件、弹窗或新的动效系统。

实施已完成，本轮本地验证通过，用户审查待进行。具体矩形、14 个助手状态点、失败重试、引擎与视口覆盖见验收记录；全项目构建由主代理统一完成。
