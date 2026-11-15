# 经历资料库页面重构实现计划

> **面向 AI 代理的工作者：** 使用 subagent-driven-development 分配本页独立实现与审查，主代理负责集成验证。按复选框记录真实完成状态。用户已授权直接重构，不重复请求同一期实施许可。

**目标：** 将常驻双栏的经历页改为独立资料库与按需阅读，保留全部已实现数据能力。

**架构：** 沿用领域 API、应用级资料缓存和公共上传/阅读组件。页面 store 管理库视图与阅读导航；卡片/列表消费相同分页元信息，正文只在阅读入口请求。

**技术栈：** 当前 React、Zustand、shadcn、Tailwind 4 与 Motion；无新依赖、数据库变更或其他页面重设计。

**规格：** [页面重构设计](../specs/2026-11-14-experience-library-redesign-design.md)。当前分支实施，不 TDD、不 commit/push。

## 文件职责

| 文件                                                                | 职责                                                                                    |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/pages/experience/index.tsx`                                    | 页面外壳、深链接、公共上传弹层。                                                        |
| `src/pages/experience/store.ts`、`types.ts`、`const.ts`、`utils.ts` | grid/list、筛选、选中、阅读开关、上传入口与公共呈现常量。                               |
| `components/workspace/index.tsx`                                    | 库/阅读导航宿主，过渡与回焦。                                                           |
| `components/library/index.tsx`                                      | 资料网格/列表、状态、真实分页。                                                         |
| `components/library-toolbar/index.tsx`                              | 搜索、筛选、视图选择。                                                                  |
| `components/source-item/index.tsx`                                  | 单份资料的卡片和紧凑行。                                                                |
| `components/source-detail/index.tsx`                                | 从 workspace 提取已有管理操作及原文，保留异步归属与失败恢复。                           |
| `hooks/use-workspace-panels.ts`                                     | 将窄屏专属导航改为各宽度一致的库/阅读切换，或用同目录清晰命名的替代 hook 后删除旧文件。 |
| `src/components/page-skeletons/experience.tsx`                      | 与新版库页相同结构的加载骨架。                                                          |

## 1. 状态与导航

- [x] 用 `view: 'grid' | 'list'`、`detailOpen: boolean` 和既有 source/version/block 建立页面状态；关闭阅读保留选中身份和筛选，账户代次变化恢复初始值。
- [x] 上传弹层开关和初始 tab 提升到页面 store，页面标题和空态复用同一动作；上传成功刷新既有资料缓存，默认留在库页，不自动加载正文。
- [x] 去掉自动选中首项与永久双栏。来源深链接调用同一 select 动作打开阅读，关闭时恢复列表滚动和原控件焦点。

```ts
type ExperienceView = 'grid' | 'list'
// select 同时设置 sourceId/versionId/blockId/detailOpen。
// closeDetail 仅关闭阅读，保留库页选择与滚动恢复数据。
```

## 2. 资料库与阅读组件

- [x] 使用已有 Card/Item 组成 source-item，网格真实摘录最多三行，标题最多两行、日期次级，异常状态保留。整体打开动作可键盘触发。
- [x] 工具栏组合 Tabs、InputGroup、ButtonGroup；网格与列表 aria-pressed 明确，所有图标按钮有名称。桌面同排，手机搜索单独一行。
- [x] library 保留现有 useExperienceList、失败重试和十项分页；网格/列表共享一批元信息，切换零请求。空态的上传/粘贴与清筛选都对应真实动作。
- [x] 提取 SourceDetail 管理逻辑，改为独立阅读页。保留所有菜单、旧版本、出处、失败反馈、上传选择代次与账户归属检查；长标题与阅读宽度合理。
- [x] 同步路由骨架，标题与真实动作在加载时保持位置。移除不再使用的双栏常量与旧移动专属状态。

## 3. 动效与实际验收

- [x] 页面往返使用公共短过渡；离开页面不参与键盘操作，进入阅读聚焦返回按钮，回库聚焦原项。运行中减少动效不留退出副本。
- [x] 用现有独立浏览器/合成传输设施在正式 App 验证 1440/1024/768/390/320px、深浅色、长标题、十项分页、卡片与列表、真正空态和失败。
- [x] 覆盖上传/粘贴、下载、改名、更新、关联、删除、旧版本 URL、资料→助手草稿保留和返回恢复；两轮切换及快速反向、触屏和键盘全部检查。
- [x] 对改动文件运行 `pnpm exec prettier <files> --write`，再 `pnpm exec eslint <source-files> --fix --fix-type layout`。运行 `pnpm exec tsc --noEmit` 和 `pnpm build`，最终清测试后执行 `pnpm format:check`。
- [x] 用 review-animations 复核；非敏感截图和验证结果记录到同日 redesign acceptance。记录“实施完成 / 验证通过 / 用户审查待进行”，删除 tests 下临时产物。

## 组件选择核对

已查看项目现有 Card、Item、ButtonGroup、InputGroup、Tabs、Dialog/Drawer 与官方 shadcn Sheet 文档。页内阅读无需新建 Sheet，也避免嵌套模态；所有现成控件继续复用，不引入新 UI 依赖。资料卡片是现有组件的业务组合，并非另造基础交互 primitive。

实施完成，已列浏览器验证及独立审查通过；用户审查待进行。前端未发布，验收记录见同日 experience-library-redesign-acceptance.md。
