# 分享管理卡片视觉实现计划

> **面向 AI 代理的工作者：** 使用 executing-plans 在当前分支逐任务实施。用户已确认效果稿，按仓库规则完成实现和验证后交审，不重复征求授权、不另建 worktree、不强制 TDD、不提交或推送。

**目标：** 将已确认的精致信息卡片效果稿落到真实分享管理首页。

**架构：** 保留 share 的组件、hooks、store、const、types、utils 结构与全部数据动作。页头合并概览，卡片分离信息和操作，复用既有控件与动效。

**技术栈：** React 19、TypeScript、Tailwind 4、shadcn/Radix、Motion、Zustand。

---

## 任务 1：概览与工具栏

文件：`src/pages/share/index.tsx`、`components/header/index.tsx`、`components/overview/index.tsx`、`components/toolbar/index.tsx`、`const.ts`。

- [x] Header 组合 PageHeader 与紧邻其下的 Overview，去掉旧 description 和页面独立 Overview；保持加载、失败与真实值分支。概览不放进标题的同一 flex 子项，避免手机长统计将新建按钮挤到下一行。
- [x] 将三个指标排成辅助文字，数字使用 tabular-nums。页签数量最小 text-xs；搜索与简历选择在窄屏同排，复用原 Popover/Command 多选和清空。
- [x] 网格使用以下容器规则，卡片数量不改变列宽：

```ts
export const SHARE_GRID_CLASS =
  'grid min-w-0 grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-4'
```

## 任务 2：信息卡片与组合操作

文件：`src/pages/share/components/card/index.tsx`、新增 `components/card-actions/index.tsx`、`components/copy-link-button/index.tsx`、`components/version-badge/index.tsx`、`const.ts`，新增 `src/components/ui/button-group.tsx`。

- [x] 从已检查的官方 radix-vega ButtonGroup 引入分组容器，使用本地 cn 和已有 Button，不新增依赖或替换全局控件。官方来源：https://ui.shadcn.com/docs/components/radix/button-group 。
- [x] 将原菜单、复制与预览组合到 CardActions；完整保留 pending、archived、onCloseAutoFocus 与 actionAfterCloseRef 交接，菜单触发器移到卡片底部。
- [x] CopyLinkButton 使用 outline 样式、复制链接文字和 flex-1 宽度；保持原剪贴板、错误提示、清理定时器与成功切换。
- [x] VersionBadge 增加显式 plain 展示，卡片采用无边框版本行，其他调用保留默认；current 使用 RefreshCw，history 使用 Pin，历史删除提示继续保留。
- [x] Card 展示用途、状态、名称、来源、版本与权限、访问记录和浅灰操作区；联系方式按四种真实组合显示：

```ts
const contactLabel = share.showPhone
  ? share.showEmail
    ? '显示联系方式'
    : '仅显示手机号'
  : share.showEmail
    ? '仅显示邮箱'
    : '隐藏联系方式'
```

- [x] 现有 PresenceDiv 入退场与 layout 保留，hover 仅边框/阴影，使用公共时长与缓动、减少动效归零。

## 任务 3：状态与实际页面验收

文件：`src/pages/share/components/content/index.tsx`；临时夹具 `tests/share-management-visual/`；证据 `.superpowers/share-management-visual/`。

- [x] Skeleton 改为真实卡片对应的层级与尺寸，接入 useReducedMotion；保留原 AnimatedContent、Empty 和重试动作。
- [x] 使用实际组件和 store 的隔离数据检查各用途、状态、联系方式四种组合、长名称、current/history/历史删除、加载/错误/空结果。夹具不连接后端、不增加正式路由，完成后删除。
- [x] 在 1440 / 1024 / 390 / 320px 检查无横向溢出、同排控件与底部操作、深浅色；搜索、状态切换、清空和复制反馈正确。
- [x] 菜单 → 设置 / 换版入口取消回焦；新建抽屉至少两轮开关和快速反向操作；确认减少动效生效。不开公开分享链接，不改真实数据。
- [x] 对改动文件执行 Prettier，再执行 ESLint layout 修复。执行 `pnpm exec tsc -b`、`pnpm build`、`pnpm format:check`、`git diff --check`，期望退出 0；既有警告另行记录。
- [x] 按 review-animations 复核，保存实际验收结果，删除临时夹具；更新规格实施/验证状态，正式页面用户审查保持待确认。

## 2026-10-31 审查修正

本次为已授权页面的局部修正，沿用既有规格，未另开功能期次。

- [x] 缩小卡片内边距、标题和段距，移除用途图标外框；网格改为最小 280px、间距 12px；操作按钮保持原尺寸。
- [x] 根据截图复现 label 被放进标题、左上角忽略 label 的问题；改为左上角优先手填备注，主标题展示简历名，保留 purpose 业务语义。
- [x] 用实际组件检查普通卡片、长文本、固定版本、权限组合、加载、深浅色和手机布局，更新验收记录并删除临时文件。
