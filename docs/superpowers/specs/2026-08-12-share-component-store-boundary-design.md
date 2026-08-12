# 分享模块组件与 Store 边界重构设计

- 日期：2026-08-12
- 状态：已批准，待书面审查
- 范围：`src/pages/share/` 管理页与快速分享弹窗
- 取代：`2026-08-11-share-store-prop-drilling-refactor-design.md`

## 1. 背景

当前分享管理页已经按页面模块拆分组件，但数据与动作仍集中在
`src/pages/share/index.tsx`。页面入口先从 Zustand Store 读取状态和动作，
再通过 props 向子组件运输：

```text
index -> grid -> card
index -> mobile-list -> mobile-item -> action-drawer
index -> settings-dialog
index -> create-dialog
```

具体问题：

- `Grid` 只为运输预览、设置、推送、启停、删除五个回调而存在。
- 桌面 Card 与移动 Drawer 依赖页面入口编排同一组操作。
- Header、Toolbar 的共享数据和 setter 由页面入口代取后传递。
- 设置目标、删除目标、创建开关分散在页面本地状态。
- 快速 `ShareDialog` 又维护一套相似的设置、删除和 CRUD 编排。
- Store 使用单一 `loading`、`error`、`mutatingId` 同时服务管理页与快速弹窗，
  两条链路会互相污染，也无法让不同链接并行变更。

本次重构参考 `src/pages/optimize/`：

- 页面入口只负责初始化和模块组装。
- 子组件直接读取共享 Store。
- 具体业务操作尽量在实际触发组件执行。
- Store 只承接跨组件共享状态、数据一致性与纯状态操作。
- 保留必要的直接父子协议，不追求形式上的零 props。

## 2. 目标

1. 将 `SharePage` 收敛为薄页面骨架。
2. 消除只用于运输共享状态和业务动作的 props。
3. 让 Header、Toolbar、Content、共享 Dialog 直接读取页面 Store。
4. 让 Card、移动 Drawer、设置/删除 Dialog 就地执行对应业务动作。
5. 保留列表实例数据、宿主能力和局部表单状态的直接 props。
6. 按职责拆分大型 Store，但不增加 command slice。
7. 隔离管理页与快速弹窗的加载、错误和请求竞态。
8. 允许不同分享链接并行变更，同一链接防止重复提交。
9. 统一页面组件命名，移除冗余的 `Share` 前缀。
10. 修正本次触及组件中的 shadcn 组合问题。

## 3. 非目标

- 不改变数据库、Edge Function 或 Supabase 数据访问协议。
- 不改变匿名查看页 `view/[token].tsx` 的状态机。
- 不重做页面视觉设计或动效规范。
- 不把所有组件改为零 props。
- 不把 `getSnapshot` 或 DOM 元素保存到 Zustand。
- 不把表单草稿、Popover、密码显隐和复制计时器提升到 Store。
- 不新增测试框架或测试文件。
- 不重构 `src/pages/resume/` 的其他业务状态。

## 4. Props 边界

### 4.1 删除运输型 props

删除以下链路：

```text
SharePage -> Header:
  total / active / canCreate / onCreate

SharePage -> Toolbar:
  keyword / resumeIds / status / resumes
  onKeywordChange / onResumeChange / onStatusChange

SharePage -> Grid:
  onPreview / onSettings / onPushLatest / onToggleActive / onDelete

Grid -> Card:
  onPreview / onSettings / onPushLatest / onToggleActive / onDelete

SharePage -> SettingsDialog:
  share / busy / onSave

SharePage -> ActionDrawer:
  share / busy / 全部业务动作
```

### 4.2 保留必要直传

保留：

- `Content -> Grid/MobileList` 的 `shares`：单次派生后的渲染输入。
- `Grid -> LinkCard` 的 `share/index`：列表实例数据，不是 prop drilling。
- `MobileList -> MobileItem` 的 `share/index/onOpen`：同一组件子树的直接协议。
- `Header -> CreateDialog` 的 `open/onOpenChange`：局部 overlay 控制。
- `QuickDialog` 的 `getSnapshot`：宿主能力注入。
- `QuickDialog -> CreateForm` 的 `onCreate`：直接父子能力协议。
- 表单组件的 `value/onChange`：受控表单协议。

不得把 `share` 改成 `shareId` 后让每个 Card 从整个 Store 查找记录。这样会增加
Store 耦合、查找成本和无关重渲染。

## 5. 目标目录与命名

页面上下文已经明确是 share，组件、目录和私有文件不再重复使用 `Share` 前缀：

```text
src/pages/share/
├── components/
│   ├── header/
│   │   └── index.tsx                 # Header
│   ├── toolbar/
│   │   └── index.tsx                 # Toolbar
│   ├── content/
│   │   └── index.tsx                 # Content
│   ├── grid/
│   │   └── index.tsx                 # Grid
│   ├── card/
│   │   └── index.tsx                 # LinkCard
│   ├── mobile-list/
│   │   ├── index.tsx                 # MobileList
│   │   ├── mobile-item.tsx            # MobileItem
│   │   └── action-drawer.tsx          # ActionDrawer
│   ├── create-dialog/
│   │   └── index.tsx                 # CreateDialog
│   ├── settings-dialog/
│   │   └── index.tsx                 # SettingsDialog
│   ├── delete-dialog/
│   │   └── index.tsx                 # DeleteDialog
│   ├── quick-dialog/
│   │   ├── index.tsx                 # QuickDialog
│   │   ├── create-form.tsx            # CreateForm
│   │   ├── link-row.tsx               # LinkRow
│   │   └── date-field.tsx             # DateField
│   ├── visibility-icon/
│   │   └── index.tsx                 # VisibilityIcon
│   ├── empty-state/
│   │   └── index.tsx                 # EmptyState
│   └── pdf-export/
│       └── index.tsx                 # PdfExport
├── hooks/
│   └── use-share-page-bootstrap.ts
├── store/
│   ├── index.ts
│   ├── data.ts
│   ├── ui.ts
│   └── types.ts
├── view/
│   └── [token].tsx
├── const.ts
├── index.tsx
├── types.ts
└── utils.ts
```

删除：

- `components/action-drawer/`
- `components/mobile-item/`
- `components/share-dialog/`
- `components/animated-visibility-icon/`
- 根级 `store.ts`

`ResumeShareRecord`、`CreateShareOptions` 等跨层领域类型保留原名。

## 6. 页面与组件职责

### 6.1 `SharePage`

只负责：

- 调用 `useSharePageBootstrap()`。
- 处理页面进入 Motion。
- 组装 Header、Toolbar、Content、SettingsDialog、DeleteDialog。

目标结构：

```tsx
function ShareManagement() {
  useSharePageBootstrap()
  const reduceMotion = useReducedMotion()

  return (
    <motion.div>
      <Header />
      <Toolbar />
      <Content />
      <SettingsDialog />
      <DeleteDialog />
    </motion.div>
  )
}
```

页面入口不读取 Store，不实现 CRUD，不派生筛选结果，不持有设置/删除目标。

### 6.2 `Header`

- 直接读取 `allShares` 和 `resumeMap`。
- 本地派生总数、有效数和是否可创建。
- 本地持有 `createDialogOpen`。
- 直接组装 `CreateDialog`。

### 6.3 `Toolbar`

- 直接读取 `resumeMap`、筛选状态和 setter。
- 本地持有简历 Popover 开关。
- 本地派生排序后的简历列表和触发器文案。

### 6.4 `Content`

- 直接读取 `allShares`、筛选状态、`pageLoading`、`pageError` 和 `reloadPage`。
- 只在此处调用 `filterShares()`。
- 负责初始加载、初始化失败、筛选空态和内容态。
- 向 Grid/MobileList 只传 `shares`。

### 6.5 `Grid` 与 `LinkCard`

`Grid`：

- 只接收 `shares`。
- 只负责网格和 AnimatePresence。

`LinkCard`：

- 只接收 `share/index/ref`。
- 自己执行预览、复制、推送、启停。
- 设置和删除通过 Store 的 UI opener 打开共享 overlay。
- 通过 `pendingShareIds.includes(share.id)` 决定禁用状态。
- 自己处理成功/失败 toast。

### 6.6 `MobileList`

- 只接收 `shares`。
- 私有管理 `selectedShare` 和 `restoreFocusTo`。
- 组装 MobileItem 与 ActionDrawer。
- Drawer 内就地执行预览、推送、启停。
- 打开设置/删除 overlay 后关闭本地 Drawer。
- 删除当前记录后关闭 Drawer。

移动端选中记录和 DOM 焦点不得进入 Store。

### 6.7 `CreateDialog`

- 只接收 `open/onOpenChange`。
- 直接读取 `resumeMap` 和 `create` 数据动作。
- 本地执行 `getResumeSnapshotById()`。
- 本地保存表单、Popover、密码显隐、日期和 submitting。
- 成功后 toast、reset、关闭；失败时保留表单。

### 6.8 `SettingsDialog`

- 无业务 props。
- 从 Store 读取 `settingsDialogOpen/settingsShareId/pendingShareIds/updateSettings`。
- 从 `allShares + shares` 解析最新记录。
- 表单草稿与校验保持本地。
- 保存成功后 toast 并关闭；失败时保留表单。

### 6.9 `DeleteDialog`

- 无业务 props。
- 从 Store 读取 `deleteDialogOpen/deleteShareId/pendingShareIds/remove`。
- 删除成功后 toast；data slice 删除记录，ui slice 关闭相关 overlay。
- AlertDialog 退出期间保留 target ID。

### 6.10 `QuickDialog`

- 只保留 `getSnapshot` 能力 prop。
- 直接读取快速弹窗状态与数据动作。
- `CreateForm` 继续通过直接 `onCreate` 调用宿主快照。
- `LinkRow` 只接收 `share/busy/getSnapshot`。
- LinkRow 直接调用 Store 完成启停、设置和删除。
- 推送最新快照临时调用 `getSnapshot`，函数不写入 Store。
- 内部挂载 SettingsDialog 与 DeleteDialog。

管理页不再挂载 QuickDialog。QuickDialog 只由简历列表页和编辑器宿主挂载。

## 7. Store 结构与职责

### 7.1 `store/index.ts`

- 通过 Zustand `create` 组装 data/ui slices。
- 默认导出 `useShareStore`。
- 保持 `./store` 与 `@/pages/share/store` import 路径不变。
- 不作为任意模块的 barrel，仅导出 Store。

### 7.2 `store/data.ts`

保存：

- `ownerUserId`
- `allShares`
- `shares`
- `resumeMap`
- `pageLoading/pageError/pageRequestId`
- `dialogLoading/dialogError/dialogRequestId`
- `pendingShareIds`

动作：

- `bootstrapPage`
- `reloadPage`
- `loadDialogShares`
- `create`
- `setActive`
- `updateSettings`
- `pushSnapshot`
- `remove`

数据动作负责：

- 调用 Supabase 数据访问层。
- 管理请求与 pending 状态。
- 同步更新 `allShares` 和 `shares`。
- 失败时恢复 pending 并抛出错误。

数据动作不负责：

- toast。
- `window.open`、clipboard、navigate。
- 获取管理页或编辑器快照。
- 决定表单、Dialog 或 Drawer 何时关闭。

### 7.3 `store/ui.ts`

保存：

- `openForResumeId/openForResumeName`
- `searchKeyword/resumeFilters/statusFilter`
- `settingsDialogOpen/settingsShareId`
- `deleteDialogOpen/deleteShareId`

动作：

- 快速弹窗打开/关闭。
- 筛选 setter。
- 设置 Dialog 打开/关闭。
- 删除 Dialog 打开/关闭。
- 删除记录后的目标清理。

关闭 overlay 时只设置 `open=false`，保留 target ID 供退出动画使用。下次打开时覆盖
target ID。

### 7.4 `store/types.ts`

定义：

- `ShareDataSlice`
- `ShareUiSlice`
- `ShareStoreState`
- Store 内部 setting payload 与 slice factory 类型。

根级 `types.ts` 只保留页面领域类型：

- `ResumeSummary`
- `SnapshotProvider`
- 其他非 Store 页面类型

不创建 command slice。

## 8. 数据流

### 8.1 管理页

```text
进入 /share
→ bootstrapPage
→ 并行读取全部分享与简历摘要
→ data slice 写入 allShares / resumeMap
→ Header、Toolbar、Content 各自直接消费 Store
```

### 8.2 管理页变更

```text
LinkCard / ActionDrawer / Dialog
→ 组件就地获取必要快照或用户输入
→ data slice CRUD
→ 同步更新 allShares 与 shares
→ 组件 toast / 关闭局部 UI
```

### 8.3 快速弹窗

```text
ResumePage / Editor
→ openDialog(resumeId, resumeName)
→ loadDialogShares
→ QuickDialog 直接读取 shares
→ CreateForm / LinkRow 临时调用 getSnapshot
→ data slice 同步 quick shares 与已加载的 allShares
```

## 9. 错误、竞态与并发

### 9.1 错误隔离

- 页面初始化只写 `pageError`。
- 快速弹窗加载只写 `dialogError`。
- CRUD 失败抛给触发组件 toast，不覆盖持久加载错误。
- 表单失败不得关闭或清空。

### 9.2 请求竞态

- 页面与快速弹窗分别维护递增 request ID。
- 响应写入前校验 request ID。
- 页面响应额外校验当前用户。
- 快速弹窗响应额外校验当前 resume ID。
- 关闭快速弹窗时递增 dialog request ID，使旧响应失效。

### 9.3 变更并发

- `pendingShareIds` 使用字符串数组，避免序列化和引用比较问题。
- 同一 share ID 已 pending 时拒绝重复动作。
- 不同 share ID 可并行。
- 每个动作在 `finally` 中只移除自己的 ID。

### 9.4 Overlay 生命周期

- Store 保存 `open + targetId`。
- 关闭时不立即清空 target ID。
- Settings/Delete 组件从最新列表解析目标。
- 删除目标后 data/ui 协同关闭相关 overlay。
- 不在 overlay 退出动画同一 tick 清空渲染内容。

## 10. shadcn 组合修正

本次触及组件同时遵守：

- 创建与设置表单使用 `FieldGroup + Field + FieldLabel + FieldError`。
- `DropdownMenuItem` 放在 `DropdownMenuGroup` 内。
- Button 内图标使用 `data-icon`，不手动设置尺寸。
- Dialog、Drawer、AlertDialog 均保留 Title 与 Description。
- `AlertDialogAction` 使用 destructive variant。
- 使用既有 `Empty`、`Spinner`、`sonner`，不新建替代组件。

视觉布局与交互语义保持不变。

## 11. 静态验收

使用 `rg` 确认：

- `SharePage` 无 CRUD handler、筛选派生、设置/删除本地状态。
- Toolbar 无筛选 props。
- Grid/LinkCard 无五个运输型业务回调 props。
- Store 无 `getSnapshot`、`HTMLElement`、表单字段和 `filteredShares`。
- 页面组件标识符无冗余 `Share` 前缀。
- 旧 `action-drawer/`、`mobile-item/`、`share-dialog/` 路径无引用。

## 12. 验证

本仓库按既有约定不新增测试文件。

运行：

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint src/pages/share src/pages/resume
pnpm build
git diff --check
```

浏览器回归：

- 管理页初始加载、失败重试和筛选。
- 新建无密码/有密码分享。
- 桌面 Card 复制、预览、设置、推送、启停、删除。
- 移动列表、Action Drawer、焦点恢复和 safe-area。
- 快速弹窗创建、设置、推送、启停、删除。
- 两条链路同时操作不同记录时 pending 状态互不阻塞。
- 关闭快速弹窗后旧请求不得回写。

## 13. 验收标准

1. `SharePage` 只负责初始化、Motion 和组件组装。
2. Header、Toolbar、Content、SettingsDialog、DeleteDialog 直接读取 Store。
3. Grid/Card 不再运输业务回调。
4. Card、Drawer、Dialog 在触发组件就地执行具体业务。
5. Store 只承载共享状态、数据一致性和纯 UI 状态操作。
6. 管理页与快速弹窗错误、加载和请求序号完全隔离。
7. 不同记录可并行变更，同一记录不能重复提交。
8. 必要直接 props 保留，不追求零 props。
9. 页面组件、目录和私有文件移除冗余 `Share` 前缀。
10. shadcn 组合修正完成。
11. TypeScript、目标 ESLint、生产构建和 diff 检查通过。
