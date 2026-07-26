# 协作模块代码清洁设计

## 背景

近期协作功能已经完成昵称气泡移除、通知昵称修复、稳定用户颜色和独立浏览双向隔离。当前行为已确认正确，但实现仍保留了若干历史路径：无人消费的点击广播、仅服务一个组件的全局 UI store、单槽远端动作状态，以及分散的当前协作者身份字段。

本次工作以代码清洁和模块边界调整为目标，不新增产品功能，不改变 Automerge 文档同步、Yjs 富文本同步和 Supabase 频道命名语义。

## 审查结论

1. `use-realtime-collab-ui` 同时负责网络连接、全局 store 写入、点击采集、动作广播和在线成员状态，职责过多。
2. 点击广播没有渲染或业务消费者，却持续注册全局事件、发送网络消息并维护清理定时器。
3. `latestRemoteAction` 只保存一个动作；同一渲染批次内到达多个动作时，前序动作可能被覆盖。
4. `CollaborationUISync` 同时承担传输编排、远端动作执行、滚动同步和控件渲染，文件过大且依赖方向混乱。
5. 当前用户身份由 `selfUserId`、`selfColor`、登录用户昵称和松散 metadata 共同拼装，无法通过类型系统保证一致性。
6. Resume Editor 的协作组件没有遵守组件文件夹加 `index.tsx` 的页面组织约定。

## 目标结构

### 协作会话身份

会话 store 使用一个 `self` 对象保存当前协作者的 `peerId`、登录用户 ID、昵称和稳定颜色。页面鼠标光标、UI 同步和富文本 awareness 都从该对象读取身份。

参与者 metadata 在 Automerge 边界被规范化为显式类型。旧客户端的 `name` 字段只在解析边界兼容，内部统一使用 `userName`。

### UI 实时同步

`src/lib/collaboration/ui` 只保留协议类型、payload 构造、频道绑定和纯状态转换，不再持有 React/Zustand 状态。

Resume Editor 页面 hook 负责一个 UI 频道实例的生命周期，并以局部 React state 返回在线协作者。远端动作通过稳定回调直接交给页面编排层，不再经过全局单槽状态，因此不会被 React 批处理覆盖。

独立浏览继续满足两个条件：不应用远端 UI 动作，也不广播本地 UI 动作。在线状态仍继续广播，以便成员列表正常展示。

### 页面组件

协作页面组件整理为以下结构：

```text
src/pages/resume/editor/components/collaboration/
  index.tsx
  collaboration-controls/index.tsx
  collaboration-dialog/index.tsx
  collaboration-runtime/index.tsx
  collaboration-ui-sync/index.tsx
  realtime-cursors/index.tsx
```

`collaboration-runtime` 成为页面与协作领域的边界：它读取会话身份并组合鼠标光标与 UI 同步。Editor 页面只传入抽屉、Tab 和滚动容器等页面状态。

UI 同步专用 hooks 移至 `src/pages/resume/editor/hooks/`，避免页面特定逻辑伪装成全局通用 hook。

## 删除范围

- 鼠标点击广播事件、payload、远端点击状态和定时清理逻辑。
- `useCollaborationUIStore` 及其仅为单组件服务的 Zustand store。
- 已失效的类型、注释和旧文件入口。

## 保留行为

- 登录用户 ID 稳定生成颜色。
- 鼠标光标、富文本竖线、成员列表和 UI 操作继续使用相同颜色。
- 跟随模式继续同步抽屉、Tab、样式配置和滚动位置。
- 独立浏览继续保持收发 UI 控制动作双向隔离。
- 加入和退出通知继续读取同一套参与者 metadata。
- 不恢复昵称气泡，不新增任何测试文件。

## 验证

- 对全部修改文件运行 ESLint。
- 运行 TypeScript 类型检查，并区分本次新增错误与仓库既有错误。
- 运行生产构建。
- 扫描确认没有测试文件和已删除点击广播符号残留。
