# 评论已读与移动端嵌套 Drawer 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让评论正常查看后立即并持久地变为已读，统一响应式 Drawer，恢复所有 Drawer 原生滚动，并消除移动排序首拖失败与触摸事件警告。

**架构：** 已读游标在 Zustand、localStorage、IndexedDB 和服务端单调推进。评论始终复用 Base UI modal Drawer；移动分享迁移到底部 Drawer。Drawer Content 与关闭手势分区，正文原生滚动、顶部柄负责下滑；移动排序使用 Motion 指针排序并与 Drawer 手势隔离。

**技术栈：** React 19、Zustand、localStorage、IndexedDB (`idb`)、Base UI Drawer、Motion、Tailwind CSS、TypeScript。

---

## 文件结构

- 修改 `src/features/resume-comments/store/create-store.ts`：同 scope 已读游标单调合并。
- 修改 `src/features/resume-comments/api/cache.ts`：为 bootstrap 缓存增加单调推进已读游标的读写函数。
- 修改 `src/features/resume-comments/hooks/use-comment-realtime.ts`：500ms 稳定查看后即时更新 UI/缓存，并按身份同步服务端；bootstrap 缓存写入使用有效游标。
- 修改 `src/pages/resume/editor/index.tsx`：编辑评论使用 modal overlay；移动排序直接打开嵌套 Drawer。
- 删除 `src/pages/resume/editor/components/sidebar/mobile-sort-dialog.tsx`：移除嵌套 Radix Sheet。
- 创建 `src/pages/resume/editor/components/sidebar/mobile-sort-drawer.tsx`：Base UI 底部嵌套 Drawer 与排序内容。
- 修改 `src/pages/resume/editor/components/sidebar/index.tsx`：装配新的排序 Drawer。
- 修改 `src/components/ui/drawer.tsx`：通用内容区退出下滑手势仲裁，恢复原生滚动。
- 修改 `src/pages/share/components/quick-dialog/index.tsx`：移动分享使用默认底部 Drawer。
- 修改 `src/pages/resume/editor/components/comment-review-banner/index.tsx`：历史提示固定且按内容宽度收缩。
- 修改 `scripts/verify-resume-comment-client.ts`：覆盖游标单调性、缓存更新和关键源码约束。
- 修改 `docs/superpowers/verification/2026-08-14-version-centric-resume-comments.md`：记录本轮自动与交互验证证据。

### 任务 1：锁定已读回退与弹层实现的失败约束

**文件：**
- 修改：`scripts/verify-resume-comment-client.ts`

- [ ] **步骤 1：加入同 scope 游标不回退断言**

在已有 `markReadLocally` 断言后，用较小的 bootstrap 游标重新 `replaceScope`：

```ts
store.getState().markReadLocally(7)
store.getState().replaceScope({
  scope: { ...firstScope, id: store.getState().scope!.id },
  version,
  counts,
  accessibleScopes: [],
  threads: [],
  eventSeq: 8,
  lastReadEventSeq: 4,
})
assert.equal(store.getState().lastReadEventSeq, 7)
```

- [ ] **步骤 2：加入缓存和 UI 源码约束**

读取 cache、mobile sort 与 editor 源码，断言：

```ts
assert.match(commentCacheSource, /updateCommentCacheReadCursor/u)
assert.doesNotMatch(editorSource, /presentation="docked"/u)
assert.match(mobileSortDrawerSource, /swipeDirection="down"/u)
assert.match(mobileSortDrawerSource, /showSwipeHandle/u)
assert.doesNotMatch(mobileSortDrawerSource, /@\/components\/ui\/sheet/u)
```

- [ ] **步骤 3：运行验证确认新约束失败**

运行：

```bash
pnpm verify:comment-client
```

预期：FAIL，至少报告已读游标回退、缓存更新函数或移动排序 Drawer 约束尚未满足。

### 任务 2：实现已读游标单调推进与浏览器持久化

**文件：**
- 修改：`src/features/resume-comments/store/create-store.ts`
- 修改：`src/features/resume-comments/api/cache.ts`
- 修改：`src/features/resume-comments/hooks/use-comment-realtime.ts`
- 修改：`scripts/verify-resume-comment-client.ts`

- [ ] **步骤 1：Store 同 scope 取最大已读序号**

在 `replaceScope` 中先计算：

```ts
const lastReadEventSeq = scopeChanged
  ? input.lastReadEventSeq
  : Math.max(state.lastReadEventSeq, input.lastReadEventSeq)
```

返回对象使用该值，并把 `accessibleScopes` 当前 scope 的摘要同步到该最大值。

- [ ] **步骤 2：增加缓存游标更新函数**

在 `cache.ts` 增加纯函数和 localStorage/IndexedDB 持久化函数：

```ts
export function advanceCommentReadCursor<T extends CachedCommentBootstrap>(value: T, eventSeq: number): T {
  const lastReadEventSeq = Math.max(value.lastReadEventSeq, eventSeq)
  return {
    ...value,
    lastReadEventSeq,
    accessibleScopes: value.accessibleScopes.map(scope => scope.id === value.scope.id
      ? { ...scope, lastReadEventSeq }
      : scope),
  }
}

export async function updateCommentCacheReadCursor(key: CommentCacheKey, eventSeq: number) {
  const database = getDatabase()
  if (!database)
    return
  const resolved = await database
  const serializedKey = serializeCommentCacheKey(key)
  const entry = await resolved.get('bootstrap', serializedKey)
  if (!entry)
    return
  await resolved.put('bootstrap', {
    ...entry,
    cachedAt: Date.now(),
    value: advanceCommentReadCursor(entry.value, eventSeq),
  })
}
```

- [ ] **步骤 3：正常查看后先更新 UI，再同步持久层**

`useCommentReadReceipt` 的 500ms timer 触发后：

```ts
const readEventSeq = lastEventSeq
store.getState().markReadLocally(readEventSeq)
void syncReadReceipt({ client, store, eventSeq: readEventSeq })
```

`syncReadReceipt` 获取认证用户 ID，派生 cache key，先同步写入 localStorage 再更新 IndexedDB。只有 owner、collaborator、登录分享用户或已有匿名评论身份才调用 `client.markRead()`；下次 bootstrap 对本机领先游标做服务端补偿同步。

- [ ] **步骤 4：bootstrap 缓存写入使用 Store 的有效游标**

bootstrap `replaceScope` 后，将响应数据通过 `advanceCommentReadCursor(response.data, store.getState().lastReadEventSeq)` 再写入缓存，避免较晚返回的旧读状态污染缓存。

- [ ] **步骤 5：运行已读验证**

运行：

```bash
pnpm verify:comment-client
pnpm exec tsc --noEmit
```

预期：两条命令 exit 0；同 scope 较小游标无法覆盖本地较大游标，cache helper 类型正确。

### 任务 3：统一编辑页 modal 与移动排序嵌套 Drawer

**文件：**
- 修改：`src/pages/resume/editor/index.tsx`
- 删除：`src/pages/resume/editor/components/sidebar/mobile-sort-dialog.tsx`
- 创建：`src/pages/resume/editor/components/sidebar/mobile-sort-drawer.tsx`
- 修改：`src/pages/resume/editor/components/sidebar/index.tsx`
- 修改：`scripts/verify-resume-comment-client.ts`

- [ ] **步骤 1：评论统一 modal Drawer**

删除 `presentation` 分支，编辑与分享无条件走 modal Drawer；保持打开评论时收起编辑面板及关闭后恢复逻辑不变。

同时保留 `CommentsPanel` 的响应式方向约束：移动端 `swipeDirection="down"` 且固定 `60vh`，桌面端 `swipeDirection="right"` 且宽度约 400px。禁止引入 Dialog、Sheet 或独立页面组件模拟评论抽屉。

- [ ] **步骤 2：创建 Base UI 排序 Drawer**

新组件使用：

```tsx
<Drawer
  open={open}
  onOpenChange={onOpenChange}
  modal
  swipeDirection="down"
  showSwipeHandle
>
  <DrawerContent className="[--drawer-content-height:min(80dvh,42rem)] [--drawer-content-max-height:80dvh]">
    <DrawerTitle>调整模块顺序</DrawerTitle>
    <DrawerDescription>长按并拖动模块进行排序，确认后应用。</DrawerDescription>
    {/* 可滚动拖拽列表与固定操作栏 */}
  </DrawerContent>
</Drawer>
```

列表使用 `min-h-0 flex-1 overflow-y-auto`，Footer 使用 `shrink-0` 和 safe area；排序用 Motion `Reorder` + 独立拖动柄并移除 hello-pangea Touch Sensor；保留取消、确认与 `basics` 固定首位。

- [ ] **步骤 3：替换装配并移除跨库 Sheet**

`sidebar/index.tsx` 导入 `MobileSortDrawer`，删除旧文件。`handleOpenSortDialog` 直接 `setSortDialogOpen(true)`，不再用 `requestAnimationFrame` 延迟跨库 modal。

- [ ] **步骤 4：运行组件验证**

运行：

```bash
pnpm verify:comment-client
pnpm exec eslint \
  scripts/verify-resume-comment-client.ts \
  src/features/resume-comments/store/create-store.ts \
  src/features/resume-comments/api/cache.ts \
  src/features/resume-comments/hooks/use-comment-realtime.ts \
  src/pages/resume/editor/index.tsx \
  src/pages/resume/editor/components/sidebar/index.tsx \
  src/pages/resume/editor/components/sidebar/mobile-sort-drawer.tsx
```

预期：exit 0；排序源码不存在 Sheet/hello-pangea，评论不存在 presentation 分支。

### 任务 4：通用 Drawer 滚动、移动分享与历史提示

- [ ] `DrawerPrimitive.Content` 加 `data-base-ui-swipe-ignore`，正文不参与下滑关闭仲裁；
- [ ] 移动快速分享使用默认底部 Drawer，长内容独立滚动；
- [ ] 评论保持默认 Drawer 外观，仅移动端固定 `60vh`；
- [ ] 历史提示改为视口顶部 fixed、水平居中、内容宽度；
- [ ] 实测编辑、评论、分享、排序滚动容器的 `scrollTop` 变化，排序入场期间首次拖动即换序。

### 任务 5：生产与真实交互验证

**文件：**
- 修改：`docs/superpowers/verification/2026-08-14-version-centric-resume-comments.md`

- [ ] **步骤 1：运行完整静态验证**

```bash
pnpm verify:comment-client
pnpm verify:comment-service
pnpm exec tsc --noEmit
pnpm build
git diff --check
```

预期：全部 exit 0；Vite 允许现有大 chunk warning，但不得有编译错误。

- [ ] **步骤 2：验证分享页已读即时变化**

在已有本地登录态中打开分享链接：

1. 观察 Badge/书签未读点；
2. 打开评论并保持可见超过 500ms；
3. 不刷新，确认提示当场消失；
4. 关闭重开、刷新页面，确认提示不恢复；
5. 重复匿名浏览器上下文验证当前浏览器持久化。

- [ ] **步骤 3：验证遮罩和嵌套焦点**

1. 编辑页桌面打开评论，确认背景变暗、没有 backdrop blur；
2. 移动端打开编辑 Drawer，再打开排序 Drawer；
3. 分别执行取消、确认和下滑关闭；
4. 每次关闭后父 Drawer 保持打开，键盘焦点回到父层；
5. Console 不出现 `Blocked aria-hidden ... retained focus`。

- [ ] **步骤 4：更新验证记录**

只记录实际执行的结果。若浏览器环境无法完成匿名或触控验证，明确标为待用户验收，不用静态检查替代交互结论。

### 任务 6：差异审查与提交

**文件：**
- 审查：本计划列出的全部修改文件

- [ ] **步骤 1：审查差异范围**

```bash
git status --short
git diff --stat
git diff --check
```

预期：只包含本轮已读、评论 overlay、移动排序 Drawer、验证脚本和验证记录。

- [ ] **步骤 2：提交实现**

```bash
git add \
  src/features/resume-comments/store/create-store.ts \
  src/features/resume-comments/api/cache.ts \
  src/features/resume-comments/hooks/use-comment-realtime.ts \
  src/pages/resume/editor/index.tsx \
  src/pages/resume/editor/components/sidebar/index.tsx \
  src/pages/resume/editor/components/sidebar/mobile-sort-dialog.tsx \
  src/pages/resume/editor/components/sidebar/mobile-sort-drawer.tsx \
  scripts/verify-resume-comment-client.ts \
  docs/superpowers/verification/2026-08-14-version-centric-resume-comments.md
git commit -m "fix(comments): 修复已读状态与移动嵌套抽屉"
```

- [ ] **步骤 3：提交后重新验证**

```bash
pnpm verify:comment-client
git diff --check
git status --porcelain=v1
git log -3 --oneline
```

预期：验证通过、工作树干净、最新提交为本轮实现提交。

## 规格覆盖自检

- 即时已读：任务 2 步骤 3；
- 同浏览器刷新持久化：任务 2 步骤 2、4；
- 登录用户服务端同步与匿名身份边界：任务 2 步骤 3；
- 旧 bootstrap/cache 不回退：任务 1、任务 2 步骤 1、4；
- 编辑页与分享页统一 Base UI Drawer，移动端底部、桌面端右侧：任务 3 步骤 1、任务 4 步骤 3；
- 编辑页背景变暗且不模糊：任务 3 步骤 1、任务 4 步骤 3；
- 移动排序迁移最新版 Base UI Drawer：任务 3 步骤 2、3；
- aria-hidden/focus 实际验证：任务 4 步骤 3；
- 自动与生产验证：任务 4 步骤 1；
- 无占位符、未引入无关重构，范围可由一个实现提交完成。
