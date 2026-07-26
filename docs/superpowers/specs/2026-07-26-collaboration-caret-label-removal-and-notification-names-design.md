# 协作光标昵称移除与通知昵称修复设计

- 状态：已确认
- 日期：2026-07-26
- 范围：富文本远端光标展示、协作 presence 昵称来源、加入/退出通知、仓库测试资产

## 1. 背景与目标

富文本协作昵称气泡在远端移动时可能遗留旧节点。产品决定不再展示该昵称气泡，但仍保留
远端彩色光标竖线。同时，加入和退出协作通知需要显示真实昵称，而不是 `用户-<id>`、
“协作者”或 `Peer <id>`。

本次目标：

- 从富文本协作光标 DOM 中彻底移除昵称节点，而不是仅用 CSS 隐藏；
- 保留远端光标竖线及原有颜色；
- 加入协作时从已加载的当前用户对象取得真实昵称；
- 加入与退出通知统一使用 participant store 中保存的 metadata；
- 删除仓库内全部测试代码文件及仅为这些测试引入的配置和依赖；
- 不新增测试，使用静态检查和生产构建验证。

## 2. 根因

### 2.1 加入通知昵称

编辑器与协作面板已经从 `useUserStore` 获得加载完成的 `currentUser`，但又单独调用
`useCurrentUserName()` 建立第二条异步认证读取链路。自动加入协作可能在第二条链路尚未返回
`full_name` 时启动，于是 `用户-<id>` 兜底被写入 presence，并成为远端加入通知的昵称。

### 2.2 退出通知昵称

加入事件已经把 presence metadata 保存到 participant store。退出回调却先从 participants
删除成员，再显示固定的“协作者已离开 / Peer xxxx”，因此丢失了本地已经存在的真实昵称。
无需为 leave 事件再传第二套 metadata；正确做法是在删除 participant 前读取这份唯一缓存。

## 3. 设计

### 3.1 富文本光标

保留自定义 caret builder，但只创建 `.collaboration-carets__caret` 外层 `span`，设置远端用户颜色
作为边框色，不再创建或追加 `.collaboration-carets__label`。删除 label 的 SCSS 规则。

此前为气泡残影尝试的 atomic inline 样式和未提交身份桥接实验不纳入本方案；回退这些实验，
避免昵称已经移除后继续维护不必要的复杂度。已有协作光标去重基础逻辑保持当前已提交版本，
仍用于减少重复竖线。

### 3.2 昵称来源

新增或复用一个同步展示名解析函数，直接从当前 `SupabaseUser` 读取
`user_metadata.full_name`。只有真实昵称为空时，才回退为 `用户-<id前六位>`。
编辑器页面、协作面板、鼠标协作和 UI 同步共用同一解析结果，避免并行异步 Hook 的竞态。

### 3.3 加入与退出通知

- participant store 是通知昵称 metadata 的唯一真源；不扩展 `onPeerLeave` 数据契约，适配层
  仍只传递 `peerId`；
- 加入：先把 presence metadata 写入 participant store，再从保存后的 participant 解析通知昵称；
- 退出：在删除 participant 前读取同一份 metadata；
- 两种通知都按 `metadata.userName`、`metadata.name`、匿名 peer 兜底的顺序解析；
- 通知标题统一为“`<昵称> 加入协作`”和“`<昵称> 退出协作`”。

## 4. 测试资产删除范围

删除项目源码中的全部测试文件：

- `src/lib/collaboration/richtext/caret-dedupe.test.ts`
- `src/lib/collaboration/richtext/caret-dom.test.ts`
- `src/lib/collaboration/richtext/caret-lifecycle.integration.test.ts`

`docs/superpowers/specs/2026-04-18-architecture-cleanup.spec.md` 是设计文档，不是测试代码，保留。
同时移除仅为上述 DOM 测试添加的 `happy-dom` 直接开发依赖，以及仅匹配这些测试文件的 ESLint
覆盖项。Vite 的通用测试文件排除规则属于构建防护，不指向实际测试资产，可保留。

## 5. 验证与验收

自动验证：

- 相关源码 ESLint；
- `pnpm exec tsc --noEmit` 与 `npx tsc --noEmit`，并单独记录已有基线错误；
- `pnpm build`；
- `git diff --check`；
- 全局扫描确认不存在测试代码文件或测试目录。

人工验收：

- 两个账号进入同一协作会话，富文本只显示远端彩色竖线，不显示昵称气泡；
- 发起者与协作者加入时，另一端通知显示各自 `full_name`；
- 任一方退出时，另一端通知显示退出者的 `full_name`；
- 无昵称账号才显示 `用户-<id>` 兜底。
