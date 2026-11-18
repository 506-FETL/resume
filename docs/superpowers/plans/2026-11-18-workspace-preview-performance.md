# 工作台缩略图生成优化实施计划

> 使用 subagent-driven-development 对独立的验证准备和实现安排工作，使用 requesting-code-review 审查最终改动。用户已授权实施后审查，不重复审批；在当前分支工作，不运行 TDD，不提交或推送。

**目标：** 减少两张真实缩略图的串行读取与多余排版，保留缓存、权限、字体和完整导出。

**架构：** 轻量预览入口并行准备正文与生成器，页面 store 有界准备并串行渲染；原分页引擎提供首页展示选项，完整文档默认行为不变。

**技术栈：** React、Zustand、ResizeObserver、现有 Vite / Playwright / Lighthouse。

## 任务 1：保留基线与建立真实验证入口

文件：`tests/workspace-preview-performance/` 内的临时基线、夹具和验证脚本；证据汇总到对应 acceptance 文档。

- [x] 保存当前 `dist` 和受影响源码，避免将已有未提交修改当作本轮修改前提交。
- [x] 使用官方默认模板与 Tinos 回退模板、固定合成短文/临界/长文，建立真实 `ScaledReadonlyPreview` / `useResumePrint` 验证入口；同时准备实际 `/workspace` 的相同隔离数据用于生产对照。
- [x] 基线记录页数、签名、第一页成品、真实正文请求与预览 ready，保存背景开/关 PDF。测试夹具不参与正式路由和 CSS 扫描。

## 任务 2：首页渲染与测量读取

文件：`src/components/resume/pagination/canonical-paged-document.tsx`、`src/pages/resume/components/resume-card/resume-focus-preview/preview-generator/index.tsx`、`src/pages/resume/components/resume-card/resume-focus-preview/index.tsx`、`src/hooks/use-mobile.ts`。

- [x] 添加默认关闭的 `firstPageOnly?: boolean`，展示数量为：

```ts
const pageCount = firstPageOnly
  ? 1
  : (displaySnapshot?.signature.pages.length ?? 1)
```

- [x] 生成器已解析模板后直接组合 `CanonicalPagedDocument firstPageOnly` 与 `ResumeTemplateRuntime`，使用相同 `snapshot`、精确 definition、assetUrls 和固定投影日期；通过 `onStateChange` 等待原 ready 再克隆第一页。
- [x] `PreviewContent` 使用 observer entry 的 contentRect.width；断点初始化与事件使用 matchMedia.matches，去掉相应同步宽度重读。
- [x] 验证完整模式仍有原页数，缩略图仅一张展示页；首张纸内容、尺寸和分页签名与基线一致。

## 任务 3：正文准备与串行渲染拆开

文件：`src/pages/resume/store/preview-types.ts`、`preview-cache.ts`、`preview-cache-state.ts`、`src/pages/resume/components/resume-card/resume-focus-preview/generate-preview.tsx`。

- [x] 预览准备协议改为返回可执行的生成任务：

```ts
export type RenderResumePreview = () => Promise<ResumePreviewPaper>

export type PrepareResumePreview = (
  request: ResumePreviewRequest,
  signal: AbortSignal,
  retry: boolean,
) => Promise<RenderResumePreview>
```

- [x] 入口用 `Promise.all` 同时加载正文读取与生成器。已取得正文后用现有转换函数恢复 snapshot，精确模板定义使用既有 store 预取；明确失败传回原重试状态。
- [x] 私有任务 Map 持有 controller 与准备好的 render 函数；最多两份任务，已准备且仍有消费者的任务按队列顺序生成，active renderer 最多一个。成功和失败后释放任务并推进队列；不要把准备结果变成无界正文缓存。
- [x] 保留原 LRU、字节预算、日期/模板/版本键与账户代次。不可见且未开始的任务移除；已开始读取在无消费者时不进入渲染；运行中的渲染仍可完成为缓存。
- [x] 用真实 store 和可控制的准备/渲染边界验证重叠读取、串行渲染、准备失败、生成失败、重试、退出/返回、重复消费者、40 份/32 MiB 淘汰、版本变更及账户往返。

## 任务 4：对照、审查与交付

- [x] 对修改文件执行 Prettier、ESLint layout；运行 TypeScript、`pnpm format:check`、`pnpm build`。
- [x] 同机同数据串行比较生产桌面/手机，单独记录模拟 LCP 与真实预览完成；至少重复三轮主要性能场景，记录实际退步和无收益指标。
- [x] 完成短/临界/长文、两模板、背景开/关真实导出，核对 PDF 文本、页数和图像；完成窄屏、深色、返回缓存、失败重试及减少动效检查。
- [x] 独立审查本轮队列、生成器与调用点，解决重要发现；更新防回归清单和验收记录，分别标记实施、验证和用户审查状态。
- [x] 清理本轮 `tests/` 脚本、数据、基线和临时服务，保留原开发服务与非敏感证据。
