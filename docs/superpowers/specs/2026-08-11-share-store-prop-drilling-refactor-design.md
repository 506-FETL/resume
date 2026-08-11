# 分享模块 Store 与 Props 链路重构设计

- 日期：2026-08-11
- 状态：已批准，待实现计划
- 范围：`src/pages/share/` 管理页与快速分享弹窗

## 1. 背景

分享模块已经具备独立管理页、快速分享弹窗和匿名查看页，但管理页入口承担了过多业务编排，并把状态与动作逐层传给子组件：

- `index.tsx -> grid -> card` 传递预览、设置、推送、开关和删除五个动作。
- `index.tsx -> mobile-list -> mobile-item -> action-drawer` 传递选中记录、焦点目标和业务动作。
- `share-dialog -> share-link-row/settings-dialog` 重复传递开关、设置、推送和删除动作。
- 管理页与快速分享弹窗分别维护设置目标、删除目标和相似的 CRUD 反馈逻辑。
- `card`、`mobile-item`、`share-link-row` 重复实现复制链接及 toast。
- 单一 `error`、`loading`、`mutatingId` 同时服务管理页和快速弹窗，两个入口之间存在状态污染和并发覆盖风险。

本次重构的目标不是消灭所有 props，而是消除只为运输共享业务状态或动作而存在的 props 链，并建立明确、可测试的状态边界。

## 2. 目标与非目标

### 2.1 目标

1. 将跨组件共享的页面业务状态与动作提升到页面级 Zustand Store。
2. 让管理页入口只负责页面骨架和真正属于页面本地的 UI 状态。
3. 让桌面卡片、移动列表、设置弹窗和删除弹窗直接消费 Store commands，不再通过中间组件转发业务回调。
4. 保留表单草稿、Popover、密码显隐、焦点恢复等局部 UI 状态，避免 Store 臃肿。
5. 拆分 Store 数据、UI 和业务命令职责，避免单文件持续增长。
6. 隔离管理页与快速分享弹窗的加载和错误状态。
7. 保证 CRUD 后管理页列表与快速弹窗列表一致。

### 2.2 非目标

- 不改变分享链接的数据库结构、Edge Function 协议或 URL。
- 不修改匿名查看页的业务状态机或视觉效果。
- 不重做分享管理页视觉设计。
- 不把所有组件改造成零 props。
- 不把非序列化的 `getSnapshot` 函数保存到 Zustand。
- 不重构 `src/pages/resume/` 的其他业务状态。

## 3. 状态边界

### 3.1 进入 Store

以下状态跨组件、跨入口或参与业务一致性，进入页面 Store：

- 分享数据：
  - `allShares`
  - 当前快速弹窗的 `shares`
  - `resumeMap`
  - `ownerUserId`
- 加载与错误：
  - `pageLoading`
  - `pageError`
  - `dialogLoading`
  - `dialogError`
  - 页面与快速弹窗请求序号
- 筛选：
  - `searchKeyword`
  - `resumeFilters`
  - `statusFilter`
- 快速弹窗：
  - `openForResumeId`
  - `openForResumeName`
- 跨组件弹层目标：
  - `settingsShareId`
  - `deleteShareId`
- 变更状态：
  - `pendingShareIds`
- 共享动作：
  - 页面与快速弹窗加载
  - 筛选设置
  - 创建、预览、复制、设置、推送、开关和删除
  - 设置/删除弹窗的打开与关闭

选中目标只保存 `shareId`。组件每次从最新的 `allShares` 或 `shares` 中解析记录，避免保存过期的 `ResumeShareRecord` 对象。

### 3.2 保持局部

以下状态只影响一个组件或一个紧密组件子树，不进入 Store：

- 管理页新建弹窗的 `open`。
- 新建和设置表单的字段草稿。
- 密码显隐、日期 Popover、简历选择 Popover。
- 表单本地校验提示。
- 复制成功图标的短时计时器。
- `useReducedMotion` 返回值。
- 移动端 Action Drawer 的当前记录和焦点恢复目标。
- 匿名查看页的加载、密码和打印状态。
- `getSnapshot` 能力函数。

管理页新建弹窗由 `SharePage` 本地控制。Header 和 Dialog 都是页面直接子节点，这种直接接口不构成 prop drilling。

移动端 Action Drawer 与列表项收敛到同一个组件目录，由 `mobile-list` 组件本地管理选中记录和焦点目标。该状态不跨页面功能分支，不需要进入 Store。

## 4. Store 结构

删除根级 `src/pages/share/store.ts`，改为单一 `store/` 目录：

```text
src/pages/share/store/
├── index.ts
├── data.ts
├── ui.ts
├── commands.ts
└── types.ts
```

### 4.1 `store/index.ts`

- 通过 Zustand `create` 组装三个 slice。
- 默认导出 `useShareStore`。
- 现有 `./store` 和 `@/pages/share/store` import 路径保持不变。

### 4.2 `store/data.ts`

职责：

- 管理分享记录、简历摘要、请求状态和错误状态。
- 调用 Supabase 数据访问层。
- 使用统一 helper 同步更新 `allShares` 与快速弹窗 `shares`。
- 管理 `pendingShareIds`。
- 通过请求序号丢弃过期响应。

低层数据动作只负责数据一致性并在失败时抛出错误，不负责决定弹窗是否关闭。

### 4.3 `store/ui.ts`

职责：

- 管理筛选状态。
- 打开与关闭快速分享弹窗。
- 打开与关闭设置/删除弹窗。
- 在关闭快速弹窗时使当前请求失效，并清理快速弹窗专属状态。
- 在记录被删除后清理指向该记录的目标 ID。

### 4.4 `store/commands.ts`

职责：

- 组合数据动作和快照来源。
- 统一业务成功/失败 toast。
- 返回 `boolean`，由表单根据结果决定是否关闭或清空。
- 提供管理页与快速弹窗的高层命令：
  - `createManagementShare`
  - `createDialogShare`
  - `previewShare`
  - `copyShareUrl`
  - `saveShareSettings`
  - `pushManagementShare`
  - `pushDialogShare`
  - `toggleShareActive`
  - `confirmDeleteShare`

管理页命令内部使用 `getResumeSnapshotById(resumeId)`。快速弹窗命令通过调用参数临时接收 `getSnapshot`，不得将该函数写入 Store。

### 4.5 `store/types.ts`

- 定义 `ShareDataSlice`、`ShareUiSlice`、`ShareCommandSlice`。
- 通过交叉类型组成 `ShareStoreState`。
- Store 内部请求和 pending helper 类型放在此文件。
- 页面领域类型继续保留在根级 `types.ts`。

## 5. 组件结构

目标结构：

```text
src/pages/share/components/
├── header/
│   └── index.tsx
├── toolbar/
│   └── index.tsx
├── content/
│   └── index.tsx
├── grid/
│   └── index.tsx
├── card/
│   └── index.tsx
├── mobile-list/
│   ├── index.tsx
│   ├── mobile-item.tsx
│   └── action-drawer.tsx
├── create-dialog/
│   └── index.tsx
├── settings-dialog/
│   └── index.tsx
├── delete-dialog/
│   └── index.tsx
└── share-dialog/
    ├── index.tsx
    ├── create-share-form.tsx
    ├── share-date-field.tsx
    └── share-link-row.tsx
```

现有 `animated-visibility-icon/` 与 `pdf-export/` 保持独立组件目录。

### 5.1 页面入口

`src/pages/share/index.tsx` 只保留：

- `useSharePageBootstrap`。
- 页面进入动效。
- 管理页新建弹窗的本地 `open` 状态。
- 加载态和初始化失败态。
- 页面组件组装。

目标骨架：

```tsx
<ShareHeader onCreate={openCreateDialog} />
<ShareToolbar />
<ShareContent />
<ShareCreateDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
<ShareSettingsDialog />
<ShareDeleteDialog />
```

管理页不再挂载快速 `ShareDialog`。快速弹窗只由简历列表页和编辑器宿主挂载。

### 5.2 Header 与 Toolbar

- `ShareHeader` 自行读取总数、有效数和 `resumeMap`，只保留直接 `onCreate` prop。
- `ShareToolbar` 自行读取筛选状态、简历摘要和 setter，删除当前筛选与回调 props。
- Toolbar 的简历下拉开关继续保留本地。

### 5.3 Content、Grid 与 Card

- `ShareContent` 从 Store 读取数据和筛选条件，一次性计算筛选结果。
- `ShareContent` 直接渲染空状态、Grid 和 MobileList。
- `ShareGrid` 只接收筛选后的 `shares`。
- `ShareCard` 只接收 `share` 与 `index`。
- Card 通过 Store commands 执行预览、复制、设置、推送、开关和删除。
- 删除 `Grid` 和 `Card` 的运输型动作 props。

筛选结果是纯派生值，不作为可写状态保存到 Store，避免源数据与派生数据不同步。

### 5.4 MobileList

- `mobile-item` 和 `action-drawer` 作为 `mobile-list` 的私有实现。
- `ShareMobileList` 只接收筛选后的 `shares`。
- `ShareMobileList` 本地保存 Action Drawer 当前记录和焦点目标。
- Drawer 的业务动作直接调用 Store commands。
- 打开设置或删除弹窗后关闭本地 Drawer。
- 当前记录删除后，本地 Drawer 自动关闭。

### 5.5 共享弹窗

`ShareSettingsDialog`：

- 无业务 props。
- 根据 `settingsShareId` 查找最新记录。
- 表单草稿与校验保持本地。
- 保存时调用 `saveShareSettings`。
- 只在保存成功后关闭。

`ShareDeleteDialog`：

- 无业务 props。
- 根据 `deleteShareId` 查找最新记录。
- 调用 `confirmDeleteShare`。
- 删除成功后由 Store 清理相关目标。

`ShareCreateDialog`：

- 只保留 `open` 和 `onOpenChange`。
- 从 Store 读取简历摘要并调用 `createManagementShare`。
- 表单和提交状态保持本地。

### 5.6 快速 ShareDialog

- 保留 `getSnapshot` 直接能力 prop。
- `getSnapshot` 是宿主能力注入，不经过中间组件，不属于 prop drilling。
- `CreateShareForm` 的 `onCreate` 是直接父子协议，保留。
- `ShareLinkRow` 只接收记录、渲染所需状态和快速推送的直接能力。
- 开关、设置和删除直接调用 Store。
- 设置与删除复用通用 `ShareSettingsDialog`、`ShareDeleteDialog`。

## 6. 数据流

### 6.1 管理页

```text
进入 /share
→ bootstrapPage
→ 并行读取全部分享与简历摘要
→ data slice 写入 allShares / resumeMap
→ Header、Toolbar、Content 直接消费 Store
```

### 6.2 管理页变更

```text
Card / Drawer / Dialog
→ Store command
→ 必要时 getResumeSnapshotById
→ data slice 调用 Supabase
→ 同步更新 allShares 与 dialog shares
→ 清理 pending 和弹层目标
→ 组件直接重渲染
```

### 6.3 快速弹窗

```text
简历列表或编辑器
→ openDialog(resumeId, resumeName)
→ loadDialogShares
→ ShareDialog 直接消费 shares
→ createDialogShare / pushDialogShare 临时调用 getSnapshot
→ 同步更新 dialog shares 与已加载的 allShares
```

编辑器继续提供当前内存快照；简历列表继续提供服务端持久化快照。两者不会被 Store 隐式混用。

## 7. 错误、竞态与并发

### 7.1 错误隔离

- 页面初始化错误只写入 `pageError`。
- 快速弹窗加载错误只写入 `dialogError`。
- CRUD 错误由 command toast 展示，不覆盖另一入口的持久错误状态。
- command 失败返回 `false`，表单不得关闭或清空。

### 7.2 请求竞态

- 页面 bootstrap 和快速弹窗加载分别维护递增请求序号。
- 发起请求时捕获当前序号。
- 响应写入前比较最新序号和当前用户/简历。
- 关闭快速弹窗时递增弹窗请求序号，使未完成请求失效。
- 同一简历快速关闭再打开时，旧响应也不得覆盖新请求。

### 7.3 变更并发

- 使用 `pendingShareIds` 跟踪正在变更的记录。
- 同一记录已有 pending 时拒绝重复命令。
- 不同记录可独立执行变更。
- 每个命令在 `finally` 中只清理自己的 ID。
- 组件根据自身 share ID 决定禁用状态。

## 8. 验证策略

本仓库当前不新增测试框架，也不为本次重构编写测试文件。通过静态接口检查、类型检查、Lint 和生产构建验证改动。

### 8.1 静态接口检查

实现完成后使用 `rg` 确认：

- Grid/Card 不再声明预览、设置、推送、开关、删除动作 props。
- Toolbar 不再声明筛选状态与 setter props。
- 管理页不再持有设置目标、删除目标和 CRUD handler。
- Store 不保存 `getSnapshot`、DOM 元素或表单字段。

### 8.2 最终验证

依次运行：

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint src/pages/share src/pages/resume/index.tsx src/pages/resume/editor/index.tsx
pnpm build
```

## 9. 验收标准

1. `src/pages/share/store/` 按 `index/data/ui/commands/types` 组织，根级 `store.ts` 已删除。
2. 管理页、简历列表页和编辑器原有分享能力保持可用。
3. 管理页入口不再编排分享 CRUD。
4. Grid/Card、MobileList/MobileItem 不再逐层运输业务动作。
5. Toolbar 直接消费 Store。
6. 设置和删除弹窗由管理页与快速弹窗复用。
7. Store 不包含表单草稿、Popover、密码显隐、Drawer 焦点或 snapshot provider。
8. 管理页与快速弹窗错误互不污染。
9. 同一记录不会重复提交，不同记录的 pending 状态互不覆盖。
10. 静态接口检查、TypeScript、ESLint 和生产构建全部通过。
