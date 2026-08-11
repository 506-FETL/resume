# 分享模块动效与打印一致性 · 设计规格

- 日期：2026-08-11
- 状态：已批准
- 范围：仅 `src/pages/share/` 分享业务模块

## 1. 目标

1. 为分享管理页的进入、筛选、增删、状态切换和移动 Drawer 提供一致、克制的 Motion 动效。
2. 修复分享预览与下载 PDF 分页布局不一致。

## 2. PDF 根因

当前分享预览和 PDF 分别渲染两套 `PagedResumeShell`：

```text
屏幕预览 → ScaledReadonlyPreview → PagedResumeShell A
PDF 导出 → SharePdfExport 隐藏节点 → PagedResumeShell B
```

字体加载、ResizeObserver 测量和 DOM 高度取整可能产生小差异；`PagedResumeShell` 通过固定高度裁切分页，数像素差异即可把章节标题和正文切到不同页面。

## 3. 打印方案

改为只渲染一份分页 DOM：

```text
ScaledReadonlyPreview
└── Motion 外层（不打印）
    └── PagedResumeShell ← documentRef
        └── ResumeTemplateRuntime
```

要求：

- `ScaledReadonlyPreview` 新增 `documentRef`。
- `ScaledReadonlyPreview` 新增 `onDocumentReadyChange`。
- `PagedResumeShell` 在分页测量稳定后上报 ready。
- `SharePdfExport` 只接收已有 `contentRef`，不再创建隐藏 `PagedResumeShell`。
- Motion transform 不得位于 `documentRef` 内部。
- 分页未 ready 时禁用下载。

## 4. Motion 规范

统一放入 `src/pages/share/const.ts`：

```ts
SHARE_PAGE_TRANSITION
SHARE_ITEM_TRANSITION
SHARE_STAGGER
```

### 页面

- 进入：`opacity 0 → 1`、`y 8 → 0`
- 时长约 220ms

### 卡片 / 移动列表

- `AnimatePresence mode="popLayout"`
- 新增：`opacity 0`、`scale 0.97`
- 删除：`opacity 0`、`scale 0.96`
- `layout` 用于筛选与状态切换后的平滑重排

### 快速分享链接列表

- `AnimatePresence initial={false} mode="popLayout"`
- Link row 使用 `motion.div layout`

### 空状态 / 列表

- `AnimatePresence mode="wait"`
- 空状态与内容交叉淡入

### Drawer 内容

- Drawer 自身沿用 Vaul 动效。
- 内部操作按钮使用短暂 stagger。

### 图标

- Eye / EyeOff 使用 `AnimatePresence mode="wait"` 轻量旋转淡入。
- 不为每个普通按钮增加无意义动画。

## 5. Reduced Motion

- 全部 Motion 动画读取 `useReducedMotion()`。
- reduced motion 下：
  - 不使用位移和缩放。
  - 动画时长为 0 或只保留必要透明度切换。

## 6. 验收

- 屏幕预览和 PDF 使用同一个 `PagedResumeShell` 节点。
- PDF 章节分页与屏幕预览完全一致。
- 筛选、创建、删除、启停后卡片平滑重排。
- 快速分享链接新增/删除有进入退出动画。
- 移动列表整卡进入/删除有动画。
- 空状态切换无闪烁。
- 打印节点不包含 Motion transform。
- `prefers-reduced-motion` 下无位移/缩放动画。

