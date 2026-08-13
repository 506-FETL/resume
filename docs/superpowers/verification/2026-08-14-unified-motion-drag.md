# 全仓库 Motion 拖拽统一验证记录

验证日期：2026-08-14

## 1. 实现范围

- 简历编辑器移动端模块排序 Drawer：保留既有手柄与确认后提交语义。
- 简历编辑器桌面横向标签、纵向 Accordion：统一为 Motion Reorder，保留既有手柄。
- 模板结构面板：整卡栏内排序及跨栏拖动，不新增手柄。
- 求职看板：整张职位卡跨列拖动，不新增手柄，终态继续使用既有确认框。
- 文件上传的原生 `dragover/drop` 不属于列表排序，未改动。
- 删除 `@hello-pangea/dnd` 及其锁文件记录。

## 2. 根因与额外修正

在移动端排序复验中发现，Drawer 内的顺序是“未确认草稿”，但共享 Hook 默认会在拖动结束后把外部旧值重新同步回来，形成“拖动已发生、结果瞬间被覆盖”的状态竞争。

最终将共享 Hook 的外部值同步策略显式化：常规受控列表继续在空闲时同步外部值；移动 Drawer 使用 `syncValuesWhileIdle: false`，并且只在“关闭 → 打开”的边沿重置一次草稿。Drawer 保持打开时，外部协作或持久化顺序变化不会覆盖用户正在调整的本地草稿。这样拖动、键盘移动和取消/确认各自只有一个状态所有者。

代码审查阶段继续补齐了以下边界：

- 单列表在 `pointercancel` 或窗口失焦时恢复拖动前快照，不产生业务提交；
- 模板落下时从最新 Zustand manifest 重新解析来源区域和索引，避免长拖动期间的旧闭包覆盖新状态；
- 跨列表容器更新 `itemIds` 时原位刷新注册信息，不通过删除再插入改变键盘左右移动的容器顺序；
- 整卡拖拽保持原有“无手柄”视觉，同时支持空格/回车拾取与放下、方向键移动、Esc 取消、可见焦点和 `aria-live` 结果播报；
- 插入线按“碰撞列表已排除活动项、渲染列表仍保留活动项”的索引差异做向下拖动修正；
- 所有 Motion Reorder 项在 `prefers-reduced-motion` 下关闭弹簧、缩放和阴影动画。
- 键盘拖拽由 Provider 统一处理焦点离开、全局 Esc、活动卡片或目标容器消失；任何异常路径都会清理会话，不会阻塞下一次拖拽。

跨列表控制器同时补齐：

- `role="button"` 交互后代不启动整卡拖动；
- 使用 `pointerup` / `touchend` 的最终坐标重新计算落点；
- 所有 `preventDefault()` 之前检查 `event.cancelable`；
- `pointercancel`、`touchcancel`、窗口失焦和卸载统一清理；
- 触摸整卡拖动在长按激活前允许原生滚动，激活后才接管手势。

## 3. 自动验证

以下命令退出码均为 0：

```bash
pnpm verify:drag
pnpm verify:comments
pnpm verify:comment-client
pnpm verify:comment-service
pnpm exec tsc -b --pretty false
pnpm exec eslint --no-ignore \
  src/components/ui/motion-reorder.tsx \
  src/components/ui/cross-list-drag.tsx
pnpm exec eslint \
  src/lib/motion-drag.ts \
  src/pages/resume/editor/components/sidebar/mobile-sort-drawer.tsx \
  src/pages/resume/editor/components/sidebar/index.tsx \
  src/pages/resume/editor/components/sidebar/sortable-tab.tsx \
  src/pages/resume/editor/components/edit-panel/accordion-editor.tsx \
  src/pages/resume/editor/components/edit-panel/section-row.tsx \
  src/pages/template/components/editor/structure-panel.tsx \
  src/pages/tracker/components/board/index.tsx
pnpm build
git diff --check
```

生产构建成功完成 5691 个模块转换。仅保留项目既有的大 chunk 提示，没有构建错误；构建产物中不再生成旧的 DnD 依赖 chunk。

全仓 `pnpm lint` 仍返回项目既有基线：1902 个问题（1890 个 error、12 个 warning），主要来自历史规格文档格式和本次未改动的旧文件。为避免扩大范围，没有批量改写这些历史文件；本次所有改动源码均通过上述定向 ESLint。

## 4. 浏览器交互证据

使用本地登录态和真实指针输入完成以下复验：

1. 桌面简历模块手柄首次拖动即可改变顺序；方向键可以恢复原顺序，最终业务顺序与测试前一致。
2. 移动排序 Drawer 打开后，草稿键盘移动立即保留，不再被外部旧值覆盖；取消退出不提交测试顺序。
3. 模板结构面板从整张卡片拖动，栏内顺序成功改变；随后已恢复测试前顺序。显隐 Switch 保持独立交互，界面没有新增手柄。
4. 求职看板将职位卡从“已投递”拖向“已录用”，成功进入既有终态确认框；点击取消后卡片仍处于“已投递”，没有产生服务端状态变更。
5. 拖动看板时横向边缘自动滚动生效，能够把视口外的“已录用”列滚入落点范围。
6. 交互后控制台未出现 `Maximum update depth`、`cancelable=false`、`aria-hidden`、`DialogRootContext` 或其他 error 级日志。
7. 模板结构卡片使用空格拾取、方向键下移、空格放下后顺序正确变化，并已用相反操作恢复原顺序；`aria-live` 播报目标栏和位置。
8. 看板职位卡使用键盘进入跨列目标后按 Esc，卡片仍保留在原“已投递”列，没有触发业务状态更新；读屏区域播报“已取消拖动”。
9. 整卡键盘拖拽中把焦点移到另一张卡片，会立即播报并取消当前会话；随后原卡片可以再次正常拾取，证明没有残留会话锁。

浏览器控制面在移动视口下提供的是鼠标指针而非真实触摸注入，因此触摸长按分支由源码生命周期检查、纯函数验证和用户已验收的移动排序手势共同覆盖；没有将鼠标复验表述成真实触摸设备验证。

## 5. 依赖与入口扫描

源码、`package.json` 与 `pnpm-lock.yaml` 中均不存在：

```text
@hello-pangea/dnd
DragDropContext
Droppable
Draggable
```

仍存在的 `dragover/drop` 入口仅用于简历文件或图片文件上传，符合本次非目标边界。
