---
name: GResume
description: 专注编辑：让简历、岗位和待处理问题成为界面重点。
colors:
  primary: oklch(0.205 0 0)
  primary-foreground: oklch(0.985 0 0)
  background: oklch(1 0 0)
  foreground: oklch(0.145 0 0)
  card: oklch(1 0 0)
  card-foreground: oklch(0.145 0 0)
  popover: oklch(1 0 0)
  popover-foreground: oklch(0.145 0 0)
  secondary: oklch(0.97 0 0)
  secondary-foreground: oklch(0.205 0 0)
  muted: oklch(0.97 0 0)
  muted-foreground: oklch(0.556 0 0)
  accent: oklch(0.97 0 0)
  accent-foreground: oklch(0.205 0 0)
  destructive: oklch(0.577 0.245 27.325)
  border: oklch(0.922 0 0)
  input: oklch(0.922 0 0)
  ring: oklch(0.708 0 0)
  sidebar: oklch(0.985 0 0)
  sidebar-foreground: oklch(0.145 0 0)
  sidebar-accent: oklch(0.97 0 0)
  sidebar-accent-foreground: oklch(0.205 0 0)
  sidebar-border: oklch(0.922 0 0)
  sidebar-ring: oklch(0.708 0 0)
  primary-dark: oklch(0.922 0 0)
  primary-foreground-dark: oklch(0.205 0 0)
  background-dark: oklch(0.145 0 0)
  foreground-dark: oklch(0.985 0 0)
  card-dark: oklch(0.205 0 0)
  card-foreground-dark: oklch(0.985 0 0)
  popover-dark: oklch(0.205 0 0)
  popover-foreground-dark: oklch(0.985 0 0)
  secondary-dark: oklch(0.269 0 0)
  secondary-foreground-dark: oklch(0.985 0 0)
  muted-dark: oklch(0.269 0 0)
  muted-foreground-dark: oklch(0.708 0 0)
  accent-dark: oklch(0.269 0 0)
  accent-foreground-dark: oklch(0.985 0 0)
  destructive-dark: oklch(0.704 0.191 22.216)
  border-dark: oklch(1 0 0 / 10%)
  input-dark: oklch(1 0 0 / 15%)
  ring-dark: oklch(0.556 0 0)
  sidebar-dark: oklch(0.205 0 0)
  sidebar-foreground-dark: oklch(0.985 0 0)
  sidebar-accent-dark: oklch(0.269 0 0)
  sidebar-accent-foreground-dark: oklch(0.985 0 0)
  sidebar-border-dark: oklch(1 0 0 / 10%)
  sidebar-ring-dark: oklch(0.556 0 0)
  reminder-interview: oklch(60.6% 0.25 292.717)
  reminder-interview-dark: oklch(70.2% 0.183 293.541)
  reminder-follow-up: oklch(76.9% 0.188 70.08)
  reminder-follow-up-dark: oklch(82.8% 0.189 84.429)
  reminder-focus: oklch(63.7% 0.237 25.331)
  reminder-focus-dark: oklch(70.4% 0.191 22.216)
  score-excellent: oklch(62.7% 0.194 149.214)
  score-good: oklch(59.6% 0.145 163.225)
  score-fair: oklch(68.1% 0.162 75.834)
  score-low: oklch(64.6% 0.222 41.116)
  score-poor: oklch(57.7% 0.245 27.325)
typography:
  headline:
    fontFamily: '"Inter Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: 1.75rem
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: '-0.025em'
  headline-compact:
    fontFamily: '"Inter Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: 1.5rem
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: '-0.025em'
  title:
    fontFamily: '"Inter Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: 1.125rem
    fontWeight: 600
    lineHeight: 1.75rem
  section:
    fontFamily: '"Inter Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: 1rem
    fontWeight: 600
    lineHeight: 1.5rem
  card-title:
    fontFamily: '"Inter Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: 1rem
    fontWeight: 500
    lineHeight: 1.5
  body:
    fontFamily: '"Inter Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.25rem
  body-description:
    fontFamily: '"Inter Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: '"Inter Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1rem
  button:
    fontFamily: '"Inter Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.25rem
  field-mobile:
    fontFamily: '"Inter Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5rem
  score-watermark:
    fontFamily: '"Racing Sans One", sans-serif'
    fontSize: 9rem
    fontWeight: 400
    lineHeight: 1
    letterSpacing: '-0.05em'
  score-watermark-sm:
    fontFamily: '"Racing Sans One", sans-serif'
    fontSize: 10rem
    fontWeight: 400
    lineHeight: 1
    letterSpacing: '-0.05em'
rounded:
  sm: calc(0.625rem - 4px)
  md: calc(0.625rem - 2px)
  lg: 0.625rem
  xl: calc(0.625rem + 4px)
  4xl: calc(0.625rem * 2.6)
spacing:
  '1': 0.25rem
  '2': 0.5rem
  '3': 0.75rem
  '4': 1rem
  '5': 1.25rem
  '6': 1.5rem
  '8': 2rem
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.primary-foreground}'
    typography: '{typography.button}'
    rounded: '{rounded.md}'
    padding: 0 0.625rem
    height: 2.25rem
  button-outline:
    backgroundColor: '{colors.background}'
    textColor: '{colors.foreground}'
    typography: '{typography.button}'
    rounded: '{rounded.md}'
    padding: 0 0.625rem
    height: 2.25rem
  button-secondary:
    backgroundColor: '{colors.secondary}'
    textColor: '{colors.secondary-foreground}'
    typography: '{typography.button}'
    rounded: '{rounded.md}'
    padding: 0 0.625rem
    height: 2.25rem
  button-ghost:
    backgroundColor: transparent
    textColor: '{colors.foreground}'
    typography: '{typography.button}'
    rounded: '{rounded.md}'
    padding: 0 0.625rem
    height: 2.25rem
  button-destructive:
    backgroundColor: color-mix(in oklab, oklch(0.577 0.245 27.325) 10%, transparent)
    textColor: '{colors.destructive}'
    typography: '{typography.button}'
    rounded: '{rounded.md}'
    padding: 0 0.625rem
    height: 2.25rem
  button-link:
    backgroundColor: transparent
    textColor: '{colors.primary}'
    typography: '{typography.button}'
    rounded: '{rounded.md}'
    padding: 0 0.625rem
    height: 2.25rem
  input-default:
    backgroundColor: transparent
    textColor: '{colors.foreground}'
    typography: '{typography.field-mobile}'
    rounded: '{rounded.md}'
    padding: 0.25rem 0.625rem
    height: 2.25rem
    width: 100%
  nav-item-active:
    backgroundColor: '{colors.sidebar-accent}'
    textColor: '{colors.sidebar-foreground}'
    typography: '{typography.button}'
    rounded: '{rounded.md}'
    padding: 0.5rem 0.75rem
    height: 2.25rem
  badge-secondary:
    backgroundColor: '{colors.secondary}'
    textColor: '{colors.secondary-foreground}'
    typography: '{typography.label}'
    rounded: '{rounded.4xl}'
    padding: 0.125rem 0.5rem
    height: 1.25rem
  card-default:
    backgroundColor: '{colors.card}'
    textColor: '{colors.card-foreground}'
    typography: '{typography.body}'
    rounded: '{rounded.xl}'
    padding: 1.5rem 0
  resume-object:
    backgroundColor: '{colors.card}'
    textColor: '{colors.card-foreground}'
    rounded: '{rounded.lg}'
    padding: '{spacing.5}'
---

# Design System: GResume

## Overview

**Creative North Star: "专注编辑"**

「专注编辑」是用户已经批准的方向。界面以黑白中性表面、连贯侧栏和明确的文字层级承载日常编辑；简历名称、岗位名称和当前问题先被看见，操作紧邻对象，统计与元信息退到辅助位置。

普通内容用留白与细分隔线组织，独立对象保留轻量容器，浮层保持现有组件的层级反馈。首页三类提醒与 ATS 分数水印是已确认的局部特色，不把语义颜色扩散成整站品牌底色，也不添加装饰循环。

2026-10-31 按用户要求保留首页。用户认为第一轮只是把卡片改成列表，视觉审查未通过；第二轮进一步建立主次：简历库按用户后续反馈统一为左侧真实纸张、右侧标题与操作的纵向文档行，取消最近与其他的区分，每页最多 10 份；分享按简历形成章节，名称与链接数量构成紧凑组标题，下方用途链接连续排列；优化以评估结论和首个待处理问题组织阅读。编辑与设置继续按章节组织。最新范围见[层级与辨识度规格](docs/superpowers/specs/2026-10-31-personal-app-character-design.md)，用户对本轮视觉效果的审查仍待完成。

本文件在上一轮实现及独立 finish review 后提取；2026-10-29 依据八项反馈更新相关布局与组件规则，不重新定义视觉方向。前置 token 以源码为准：`src/index.css`、`src/components/ui/`、`src/components/layout/`、`src/lib/motion.ts` 和已安装 Tailwind 主题。范围仅为应用界面；保留 GResume 名称与既有 SVG 图标，不新增生产位图。页面构图详见[方向合同](.impeccable/surfaces/src-app-tsx.md)与[已批准规格](docs/superpowers/specs/2026-10-29-visual-redesign-design.md)。

**Key Characteristics:**

- 连续的侧栏与正文区域，选中态清楚，外壳不悬浮。
- 对象名称优先，正文与操作可读，辅助信息简短。
- 普通信息行保持平整，独立对象沿用现有 shadcn 容器。
- 深浅主题共享结构；过渡轻量，并动态响应减少动效偏好。

## Colors

整体是无彩色的黑、白与灰；语义色只在需要辨认任务与状态的位置出现。前置颜色未转换成近似十六进制值，保留源码 OKLCH。无后缀是浅色主题，`-dark` 是同名 CSS 变量在深色主题的值，不代表新品牌色。

### Primary

- **墨色主动作 / 浅色主动作**：`primary` 与 `primary-foreground` 用于主要按钮；深色主题交换明暗关系，让主动作继续清楚。
- **提醒紫、跟进琥珀与关注红**：`reminder-*` 对应首页面试、到期跟进、重点关注。深色图标使用较亮的既有色阶；数量标签沿用各自浅底/深色透明底和文字配对。
- **危险操作与评分**：`destructive` 用于危险或错误状态；`score-*` 记录现有评分颜色。ATS 从高到低按 90 / 80 / 60 / 40 分分档，可读性按 9 / 7 / 5 / 3 分分档。评分函数目前不额外切换深色专用色值，不在文档里虚构另一套映射。

### Neutral

- **页面与对象表面**：`background`、`card`、`popover` 分别用于页面、独立对象与浮层。浅色主题三者同为白色；深色主题将对象/浮层与页面拉开一档。
- **文字**：`foreground` 承载正文；`muted-foreground` 承载时间、辅助说明与元信息。`card-foreground`、`popover-foreground` 保持对应表面对比。
- **弱反馈表面**：`secondary`、`muted`、`accent` 是中性浅层，不是第二品牌色；它们承担次按钮、悬停与选中反馈。
- **边界与焦点**：`border`、`input` 和 `ring` 区分静态分隔、表单边界与键盘焦点。深色边界保留源码透明度，不替换成不透明灰。
- **连续侧栏**：`sidebar`、`sidebar-foreground`、`sidebar-accent`、`sidebar-border`、`sidebar-ring` 随主题映射。普通导航选中用中性 accent；AI 入口保留中性表面，以小面积紫色图标和细边界增强辨识，不使用全幅渐变。

**The 语义色有依据 Rule.** 颜色说明状态、提醒类别或真实评分，同时保留文字或图标；不把分数包装成录用概率。

## Typography

**Body Font:** 应用页面内容使用前置 `typography` 中的 Inter Variable 与中文系统回退。全局 `--font-sans` 仍为 Inter Variable、sans-serif；DashboardShell 只对明确的页面布局与工作区内容设置中文回退，不借此覆盖文档区域。

**Display Font:** Racing Sans One 仅用于 ATS 装饰性真实分数，保持本地字体依赖。普通标题继续使用应用无衬线字体。

**Character:** 层级由字号、字重、行距和对齐形成。没有为全站建立等比放大的展示字阶，也没有用模板中的衬线或手写字体装饰界面。

### Hierarchy

| 角色         | 前置 token                           | 实际用途                                                      |
| ------------ | ------------------------------------ | ------------------------------------------------------------- |
| 页面标题     | headline / headline-compact          | PageHeader：sm 起使用前者，窄屏使用后者；字重与紧凑字距一致。 |
| 对象标题     | title                                | 首页最近简历名称等主要对象。                                  |
| 区块标题     | section                              | 首页最近简历、求职提醒与概况分区。                            |
| 基础卡片标题 | card-title                           | CardTitle 默认值；页面可明确提升至 section。                  |
| 正文与说明   | body / body-description              | 正文默认较紧，PageHeader 说明使用较舒展行距。                 |
| 标签与元信息 | label                                | Badge、短状态与辅助数字；普通日期也可使用同字号常规字重。     |
| 操作文字     | button                               | 标准按钮与导航选中项的文字等级。                              |
| 移动输入     | field-mobile                         | Input 默认字号，md 起回到正文尺寸；不把移动输入一律压成小字。 |
| ATS 水印     | score-watermark / score-watermark-sm | sm 起放大；装饰性、等宽数字、读屏隐藏。                       |

具体值由前置 token 给出。正文行宽随页面用途变化，不强加一条未经实现的全站字符数限制。页面标题与对象标题不能因长名称挤掉操作；已有容器允许收缩、换行或按具体场景截断。

**The 应用与纸张分离 Rule.** 这里的字号、字体、容器和主题仅约束应用 UI，不覆盖简历纸张、模板正文、字体、测量、分页或打印副本。

## Layout

- **连续外壳**：DashboardShell 的展开侧栏为 14rem，图标折叠为 3rem；移动侧栏使用 18rem。组件基础默认的 16rem 已被当前外壳覆盖，不能误记成在用宽度。主导航在小于 768px 时改用抽屉；正文头部最小高度为 3.5rem，编辑工具栏保留可换行高度。
- **管理页**：PageLayout 默认最大 80rem，宽版最大 1600px，窄版最大 56rem。默认区块间距为 spacing.8；手机横边距 spacing.4、纵边距 spacing.6，sm 起横边距 spacing.6、纵边距 spacing.8，lg 起横边距 spacing.8。
- **工作区**：workspace 布局使用可用宽高，最小高度 30rem；区块间距与手机内边距为 spacing.4，sm 起内边距为 spacing.6。编辑、历史与助手各自保留面板滚动和原操作结构。
- **窄表单**：AuthLayout 最大宽度 24rem；手机横边距 spacing.4，sm 起 spacing.6。上下留白按认证布局源码设置，不让认证表单套用管理页宽度。
- **间距节奏**：前置 spacing 来自现有 0.25rem 基础单位。相关元素多用 8–16px，独立区块使用 24–32px；字段、按钮和密集工具栏仍按既有组件密度组合。
- **页面结构**：简历库所有条目使用相同的真实纸张预览与 28px 桌面标题，信息在右上、主操作在右下，条目之间用细分隔；按更新时间排序，每页最多 10 份，不再分出焦点和次级集合。分享按简历分组，名称与链接数量作为整组顶部标题，标题与链接同宽并共用对齐线；各屏幕均上下连续排列，访问记录为辅助。优化引言使用 22–24px 结论，首个待处理问题默认展开，其他问题保持次级折叠；桌面 18rem 辅助列承载清单，评分依据与工具居后。手机按 DOM 顺序排列。
- **响应式**：使用现有 sm / md / lg / xl 断点，值保存在 sidecar；通过换行与列数变化处理窄屏。首页最近简历在 md 起为两列，三提醒在 lg 起为三列；待办 / 概况在 lg 起并列，漏斗 / ATS 趋势 / 本周活跃度另起三列，快捷与动态位于其后。不再使用贯穿页面的 17rem 长侧栏，各行按内容自然高度排列。

页面整体避免非预期横滚；看板继续保留内部横向滚动、最小列宽与三页签详情抽屉。普通区块不用重复的外框制造层级。

## Elevation & Depth

界面主要依靠明度差、留白和细线表达层级。现有 Card、Input 与描边按钮仍保留基础轻阴影；因此不能将实现描述为“全站完全无阴影”。普通信息行取消额外轮廓与阴影；首页提醒保留完整的单层轻边框与 lg 圆角，取消 Card 的默认 ring 和阴影。独立对象同样避免重复轮廓。下拉菜单、抽屉等浮层才承担更明显的浮起感，简历纸张阴影不由此文档重定义。

### Shadow Vocabulary

- **基础细影**：Tailwind shadow-xs，用于现有 Card、Input、SelectTrigger 与描边按钮。它不是给每个业务区块追加阴影的理由。
- **菜单浮层**：SelectContent 使用 shadow-md，并配一层前景色低透明度 ring。
- **抽屉浮层**：DrawerPopup 使用 shadow-xl；嵌套抽屉保留源码已有的向上投影。
- **轮廓与焦点**：Card 和 Dialog 的前景色 10% 轮廓用于分隔表面；表单/按钮的 3px、ring 色 50% 焦点环用于键盘反馈，导航为 2px 侧栏焦点环。它们不是装饰阴影。

阴影的完整 CSS 值放在 sidecar，不将阴影塞入 frontmatter 不支持的字段。

**The 信息先于容器 Rule.** 普通内容优先用留白和分隔线，独立对象才使用容器；不要为每个区块重复叠加圆角、描边和阴影。

## Shapes

控件沿用 shadcn 的柔和圆角：Input、SelectTrigger 与普通 Button 使用 md；首页最近简历、待办与 ATS 摘要在业务层选择 lg；共享 Card 默认与 Dialog 使用 xl。简历行仅在悬停和聚焦时出现轻背景，分享行、编辑章节和设置分区使用细分隔，不增加整圈外框。前置圆角保留基于现有根值的计算式；按默认 16px 根字号，md 为 8px、lg 为 10px、xl 为 14px。共享 Card primitive 的默认值仍为 xl，不能为去除业务卡片而全局改小半径。

普通内容用留白/分隔线，独立对象组合现有 shadcn Card，并按本轮普通容器约束显式选择 lg 半径。首页提醒使用 lg 圆角的独立轻容器，内部标题与说明对齐；Badge 使用 4xl 圆角，短高度形成胶囊。抽屉沿用自身受上限约束的圆角，不强行统一成卡片。边框通常为 1px，按语义色 token 和透明度区分，焦点边框保留。

## Components

### Buttons

紧凑、动作明确，优先复用 Button 的既有 variants。

- 标准尺寸高 2.25rem，左右内边距 0.625rem，图标通常为 1rem；小号高 2rem，超小号高 1.5rem，大号高 2.5rem，图标按钮对应同档尺寸。
- primary 使用主动作与反色文字，hover 降低背景不透明度；outline 使用细边界与基础细影；secondary 使用弱表面并混入少量前景色反馈；ghost 用于行内与次级动作；destructive 使用危险色透明底；link 用于文字链接。
- 键盘焦点使用边框加焦点环；禁用透明度为 50% 并停止指针动作。非弹层触发按钮按下时下移 1px，减少动效时不增加运动过程。
- 按钮颜色、轮廓与按压过渡优先使用公共 fast 时长及进入缓动；导航业务层显式使用 base 时长。

### Chips

Badge 承载简短的状态、数量和版本信息，默认高度 1.25rem。优先选 secondary / outline 等弱样式，语义信息保留文字；首页提醒数量根据提醒类别与主题成对取色。只有链接型 Badge 承担对应悬停与键盘焦点，不把静态标签伪装成按钮。

### Cards / Containers

Card 是可复用基础组件：默认上下间距与内容左右内边距为 spacing.6，sm 规格为 spacing.4，默认有细影和低透明度 ring。需要信息行时明确取消这些默认值；只删外层边框不足以去掉基础 ring。

首页最近简历使用 lg 圆角的单层边框对象容器，内边距为 spacing.5，名称、日期和动作顺序固定；不是把全部页面重新包成 Card。简历列表中的本地 / 云端 / 岗位版本以灰 / 蓝 / 紫的图标区与文字 Badge 区分；岗位版本优先显示其角色，另标真实保存位置，保留来源、模板和生成状态。普通设置区按分组标题与信息行组织。

简历行不加完整外框，真实纸张保留自身阴影。仅可见项生成预览，同时最多一个排版实例；成品按账户、内容版本和模板引用缓存，切换返回直接复用，编辑后只重建对应项。分享文档身份不单独包灰底卡，左侧 40px 文档标识配合两层文字，简历名称为桌面 24px / 手机 20px 主标题，链接数量为下方 12px 说明；组标题下接整组宽度的链接，组内细分隔、组间留白。文档名最多两行，完整名称保留 title 与读屏文本。骨架匹配各自构图，空数据与失败区分。优化首要问题展示真实原因、原文和修复建议，其余保持可展开，工具内部仅保留输入、告警和前后对比的必要边界。历史详情连续排布，编辑器只在拖动章节时浮起；求职表格、模板画廊和看板保留原用途。

### Inputs / Fields

Input 与 SelectTrigger 采用细边框、md 圆角、标准 2.25rem 高度；深色输入背景来自 input 色的透明混合。Input 在 md 前保留 field-mobile 字号，md 起使用正文大小。错误通过 aria-invalid 的危险边框与焦点环表达，禁用状态保留光标与透明度反馈。

Select 使用 Radix 的选择、方向键、Escape、滚动和焦点行为。浮层与触发器沿用现有组件，不能用原生下拉框或另写弹层替代。模板筛选在手机上每组一行标签与选值，长选项放在受可用高度约束的滚动浮层中；桌面保留侧栏按钮组。Input/SelectTrigger 现有色彩与阴影过渡仍继承 Tailwind 默认 150ms；这不等于仓库公共 DURATION.base，文档不把二者混写。

### Navigation

AppSidebar 是连贯侧栏，主导航行高 2.25rem、水平内边距 spacing.3、图标 1rem；项间距 spacing.1。普通文字降低透明度，当前项恢复完整侧栏文字色并用中性 accent 底标记。图标折叠保留 Tooltip 与可读名称，手机在导航后关闭抽屉。选中态用当前路由驱动，不能用动画替代状态。

AI 助手入口沿用真实 SidebarMenuButton 与 Link，使用 40px 高度、中性 background、细边框与小紫色图标；这项本轮用户修订取代全幅高饱和渐变方案。悬停 / 键盘聚焦给图标 6° 轻转与箭头透明度反馈，减少动效取消运动过程。保留当前页、返回路径、折叠 Tooltip 和手机关闭侧栏行为。

### Reminders & ATS

首页三提醒各自使用完整的轻容器，保留紫 / 琥珀 / 红语义与对应数量标签，左上局部径向渐变与淡色大图标不占布局。图标为 5.5rem、旋转 −12°，浅色透明度 9%、深色 12%；渐变椭圆为 180px × 110px，在 72% 处消退，浅色透明度 14%、深色 12%。这些数值只属于该已确认组件，不扩展成全站装饰预设。

ATS 使用当前真实分数作水印，保留 Racing Sans One、评分色与左上渐变；水印浅色透明度 8%、深色 12%，渐变椭圆为 400px × 240px。加载和无报告时不显示水印，正文仍明确显示实际分数和评分依据。优化摘要以响应式网格排列评分、说明与可读性；桌面直接展示评分依据、所有维度理由与可读性建议，手机保留折叠。内嵌紧凑雷达与依据共用一份正文，参考内容在其后全宽；静态维度标题与理由区域保持有效的读屏关联。无报告复用摘要的真实行动提示，不再重复渲染空雷达，旧协议仍保留分数与紧凑加载反馈。

首页三提醒同一行等高，每张右上角提供真实“查看全部”跳转，手机单列自然高度。统计按标题、数字、说明纵向排列。简历库改用统一的纵向文档行后，旧的 24rem 卡片列宽约束不再适用；纸张预览桌面 132px 宽、手机 88px 宽，避免放大成海报。求职跟进的准备简历区直接展示，内部绑定继续使用原 Select。

### Motion & Overlays

动效数值的唯一源码是 `src/lib/motion.ts`；sidecar 记录快照以供工具展示。进入通常用 fadeInUp 或 fadeScale，退出更短；列表使用已有 staggerDelay。频繁内容切换使用 CONTENT_SWITCH 的先退后进，常驻编辑面板保留 DOM、输入与滚动，不为切换动画重建状态。

创建向导的标题、正文与页脚作为一个步骤切换；外框测量布局尺寸、正文保持目标宽度，关闭重开时回到入口尺寸。星标图标等待所有数字位的真实 spring 完成再做一次缩放回落与填色，不用估算 timer；减少动效直接到目标值，关闭后不从 0 重播。

手机端不因窄屏或触摸输入取消过渡。历史列表与详情使用公共 CONTENT_SWITCH 先退后进，左右位移不超过 8px，保留常驻 DOM 和滚动位置；退出先交接焦点，再隔离交互。手机简历工具栏与编辑操作采用 36px 图标按钮，模式切换内部为 32px，不以粗指针为由统一放大。390px 工具栏应保持单排，320px 允许自然换行但不得溢出。

MotionProvider 将 DURATION 与 EASE 映射到 `--ui-motion-*`，`src/styles/motion.css` 管理浮层、抽屉及常见控件。Radix 用 data-state，Base UI 按各自真实属性处理；不可跨 primitive 照搬选择器。退出内容先交接焦点，再隔离交互；Dialog 关联说明。

减少动效必须从 `@/hooks/use-reduced-motion` 动态订阅，运行中变化立即生效；不能改回 Motion 12 只读挂载值的同名 hook。CSS 媒体规则同步归零时长/延迟，JS 动画仍需按组件取消或落到终态。仅已批准的简历检查原文荧光笔高亮保留一次划过动画，例外不扩展到其他界面。

## Do's and Don'ts

### Do:

- Do 先确认已有 shadcn/ui、Magic UI 与业务封装，再组合页面；保留原有键盘、焦点和禁用行为。
- Do 让标题、对象名称、必要状态和直接动作按顺序可见，并分别检查深色、浅色与窄屏。
- Do 用各模块真实依赖呈现加载、失败、未知与空数据；重取失败时保留已有内容并提供重试。
- Do 复用 EASE、DURATION、CONTENT_SWITCH 和动态 useReducedMotion；检查进入、退出、连续两轮开关和快速反向。
- Do 保留首页三提醒的完整轻容器、语义色、淡色大图标与局部渐变，以及 ATS 的真实分数水印；装饰不参与布局、点击或读屏。
- Do 逐行检查整页自然高度，评分依据同时验证折叠与展开，手机筛选用长选项验证浮层与焦点。

### Don't:

- Don't 把普通设置区重新包成等权大卡，或为独立对象增加追随光晕、常驻粒子与无意义旋转；AI 入口不使用全幅高饱和渐变。
- Don't 把应用字体与容器 token 用到简历正文、测量页或打印副本，也不改写用户内容与历史对话。
- Don't 用颜色代替文字状态，用空态掩盖加载失败，或保留没有后续结果的交互入口。
- Don't 将 Radix 的 data-state 和 Base UI 的 data-open / data-closed 状态选择器混用；Dialog 必须关联说明。
- Don't 把截图检查说成完整交互或导出验收，也不把设计方向批准写成用户已审查最终结果。
