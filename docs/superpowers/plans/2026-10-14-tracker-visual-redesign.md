# 求职跟进视觉改版 实现计划

> **面向 AI 代理的工作者：** 使用 subagent-driven-development 逐任务实施；当前分支工作，不推送。仓库不要求 TDD，以类型检查、Lint、构建及浏览器验证为准。

**目标：** 将已批准的方案 A 落实为层级清楚、适配不同屏幕的求职跟进工作区。

**架构：** 复用现有 Zustand store、数据接口及拖拽引擎。页面负责加载及状态分流，header 只保留标题和新增，toolbar 承接过滤及批量操作，overview-bar 与 board/list 各自负责呈现。

**技术栈：** React 19、TypeScript、Tailwind CSS、Motion、Zustand、现有 shadcn UI。

## 全局约束

- 仅修改 `src/pages/tracker/` 与本次规格/计划；使用现有接口，不修改数据库、共享弹窗或全局主题。
- 动效复用 `EASE`、`DURATION`、`SPRING`，每处接入 `useReducedMotion()`。
- 保留列表的指标筛选、看板的阶段定位、归档、排序、批量选择、拖拽、终态确认及失败回滚。
- 新建独立组件使用 kebab-case 目录加 `index.tsx`。共享状态仍在页面 store，确认弹窗状态保持局部。

## 文件职责

- `index.tsx`：页面布局、视图和加载/错误/空态分流。
- `hooks/use-tracker-jobs.ts`：提取现有加载入口，复用为重试，保留错误信息解析。
- `components/header/index.tsx`：图标、标题、说明、新增。
- `components/toolbar/index.tsx`：结果数量、视图切换、搜索、过滤、排序、归档。
- `components/batch-actions/index.tsx`：迁移现有批量管理和确认操作。
- `components/page-state/index.tsx`：首次空态、归档空态、搜索无结果、失败、视图骨架。
- `components/overview-bar/{index.tsx,metric-card.tsx}`：四张统计卡及响应率说明。
- `components/board/{index.tsx,column-card.tsx}`：看板宽度、列层级、职位卡片。
- `components/list/{index.tsx,job-table.tsx,job-card.tsx}`：桌面表格及手机卡片。
- `const.ts`：补齐阶段/日期颜色的深色模式与可复用显示标签。

## 任务 1：页面结构、加载与工具栏

- [x] 提取加载 hook，用稳定的回调提供重试。进入时继续用 store 的 loading/isInitialized 防止重复加载。

```ts
export function useTrackerJobs(): { reload: () => Promise<void> }
```

- [x] 将旧 header 中批量处理逻辑迁入 batch-actions；已有请求和终态确认保持原样，计数使用与 `selectAll` 相同的过滤范围。
- [x] header 只保留 `BriefcaseBusiness` 图标、求职跟进标题、说明和新增按钮。
- [x] toolbar 第一行显示“职位进展”与数量、ViewToggle，第二行放搜索和管理操作。查询用以下同源逻辑：

```ts
filterJobs(jobs, viewMode === 'list' ? filterStatus : null,
  searchKeyword, showArchived, viewMode === 'list' ? metricFilter : null)
```

- [x] 添加清空搜索、筛选/定位提示和归档退出；批量工具条和提示使用 AnimatePresence 高度过渡。
- [x] page-state 使用明确 mode 分支展示 skeleton / error / empty / archived / filtered；清除操作同时清空关键字和过滤状态，归档空态返回活跃范围。
- [x] 页面先处理 loading、error、数据范围为空，随后展示 board/list；外层 `max-w-[1600px]`，主体最小高度保障低屏幕可滚动。

## 任务 2：统计及主题细节

- [x] 四卡依次为已投递、面试中、已录用、待跟进；复用 `getTrackerOverviewStats` 和 useCountUp，不改变数据口径。
- [x] 卡片使用语义图标、24–30px 数字、简短说明，活动态有边框和弱背景，待跟进大于零用琥珀色；每卡提供明确 aria-label。
- [x] 手机 2×2，桌面四列；响应率使用辅助细行、进度条和统计口径说明；首次空态保留零值，失败显示破折号。
- [x] 在 const 中保留已有字段，补充状态点色映射和指标标签；为阶段/日期颜色补充 dark 变体。

## 任务 3：看板与列表内容（专用子代理）

- [x] 只修改 board/list 文件。其他文件由主代理修改，不创建全局样式或改动 store。
- [x] 看板列最小宽度 232px，按可用空间均分，已终止折叠列 44px；保留看板内部横向滚动、每列纵向滚动及拖拽自动滚动。
- [x] 列使用轻背景和圆角，头部有状态点、数量和已有阶段说明；空列顶部紧凑提示，无 flex-1 撑满的虚线框。
- [x] 卡片主体展示公司标识/公司名、两行职位名、地点薪资；下方分隔区展示下一步和日期/停留，辅助标签保持精简。CSS hover 位移须降级。
- [x] 表格字段为公司/职位、地点/薪资、当前阶段与停留、下一步跟进、最近更新、操作；保留原有排序及菜单，增加可键盘打开职位的按钮。
- [x] 手机卡片采用同样信息层级，保留菜单与批量选择。无需修改抽屉业务。
- [x] 列表空状态由主页面处理，列表内部仅呈现已过滤排序的数据；避免重复空态和多层过渡。
- [x] 对改动的 board/list 文件执行 ESLint 并报告结果，由主代理进行规格和代码审查。

## 任务 4：集成验证与审查

- [x] 检查任务 1–3 组件与父容器配合，执行：

```powershell
pnpm exec eslint src/pages/tracker
pnpm exec tsc --noEmit -p tsconfig.app.json
pnpm build
pnpm verify:drag
git diff --check
```

- [x] 本地浏览器核验 1440、1920、1024、390、430 宽度；侧栏展开/收起；明暗主题；看板/列表；搜索、统计点击、排序、选择模式、新增及详情入口。
- [x] 隔离开发验证页中使用合成数据验证空态、多阶段长文本、归档、失败/重试、拖拽终态确认及回滚；所有数据变更只在隔离本地服务处理，不写用户云端记录。
- [x] 减少动效模式核验与弹窗连续两轮开关；必要时检查退出中重新打开。
- [x] 最终审查覆盖规格和代码质量；修复有证据的遗漏，依据改造前观察记录核对并保存改造后截图，审计最终 diff。

## 执行记录

- 2026-10-14：设计已批准，开始当前分支实现。

### 最终验收（2026-10-14）

- 全部实现任务完成；最终整体审查及焦点修复定向复审通过。
- `pnpm exec eslint src/pages/tracker`：exit 0，无错误。
- `pnpm exec tsc --noEmit -p tsconfig.app.json`：exit 0，无错误。
- `pnpm build`：exit 0；仍有项目既有的 circular chunk 与大 chunk 提示，本次未扩大范围处理。
- `git diff --check`：exit 0。
- `pnpm verify:drag`：已执行但未通过，原因是仓库缺少脚本指向的 `scripts/verify-motion-drag.ts`。使用隔离本地浏览器验证补足本次交互验收，未将该命令记为通过。
- 浏览器覆盖 1440、1920、1024、390、430 像素，明暗主题及侧栏展开/收起；文档宽度与视口相同，窄屏仅看板/桌面表格内部横向滚动；表格内部纵向滚动与 sticky 表头正常。
- 使用真实单职位页面核验集成效果；在禁止外部请求的本地 mock 页面核验多阶段、长文本、空态、归档、无匹配、加载及失败重试。没有向真实职位写入验证数据。
- 搜索、指标筛选、排序、列表/看板切换、归档、阶段定位、已终止自动展开、筛选后全选（2/2）均已核验。
- 鼠标与键盘跨列拖拽通过；失败请求回滚及拖入“已录用”的终态确认通过。
- 新增和详情入口完成两轮打开/关闭，详情支持 Enter 打开和 Escape 关闭；共享弹窗动画未改，不需要进行共享动画专项反向切换验收。
- 减少动效模式：统计卡 transition 为 0s、无 transform，加载骨架 animationName 为 none，定位仍正常。
- 修复新空态退出时的焦点问题；清除搜索与筛选、清空搜索、重试、退出归档及返回职位进展后，activeElement 为 tracker-search，且没有 inert/aria-hidden 祖先。最终隔离页 console warn/error 为空。
- 验证截图保存在已忽略的 `.superpowers/sdd/tracker-visual/`：actual-board-1440.jpg、actual-list-1440.jpg、board-fixtures-1920.jpg、list-fixtures-1920.jpg。多职位截图明确使用合成数据。
- 最终范围审计：只包含 `src/pages/tracker/` 及本次 spec/plan；在 main 分支保留未提交改动，未 push。

### 范围外既有问题

- 既有批量全选仅比较选中数量与结果数量；切换到另一组相同数量的筛选结果时，可能误判已全选。审查确认 HEAD 已存在此行为，本次未修改，单独待后续授权。
