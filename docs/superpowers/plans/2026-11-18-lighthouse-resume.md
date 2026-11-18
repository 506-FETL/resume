# 简历库 Lighthouse 优化实现计划

**目标：** 修复报告中的实际缺陷，并用同条件生产构建核验加载收益。

**架构：** 沿用现有 Zustand、Radix 和 deferred-content；仅将日历引擎移到日期浮层加载。头像优化放在现有裁剪出口，数据写入流程不变。

**技术栈：** React、TypeScript、Vite、Lighthouse、现有 Playwright 验收工具。

- [x] 保存当前生产构建为 tests/lighthouse/baseline-dist，建立独立浏览器数据；记录生产 `/resume` 的指标、日历资源与无障碍失败。
- [x] 修改 `src/pages/share/components/quick-dialog/date-field.tsx`：用 `createDeferredComponent(() => import('./calendar-content'), …)` 替换静态 Calendar；组合现有 Skeleton，保留 Popover 生命周期与 Calendar 的 autoFocus。
- [x] 修改 `src/pages/resume/index.tsx` 和 `components/library-results/index.tsx`：用稳定结果区 ID 和分类触发器 ID 建立 `aria-controls` / `aria-labelledby`，保留单一真实列表和现有动效。
- [x] 修改 `components/template-badge/index.tsx`：去掉覆盖 secondary 的 `text-muted-foreground`。修改 GitHub 数字组件与页头：数字滚轮 `aria-hidden`，完全移出裁切区的字形不可见，可访问计数来自实际 stars，链接名称包含当前数字。同步为已命名的页面内容容器补 region 语义。
- [x] 新建 `public/robots.txt`，内容为 `User-agent: *` 和 `Allow: /`，验证 HTTP 正文与生产打包结果。
- [x] 修改 `src/lib/crop-image.ts` 和账户头像调用：显式 192px WebP、质量 0.85、圆形 alpha；输出 File 按真实 Blob MIME 命名。保持原裁剪与上传/清理顺序。
- [x] 执行 `pnpm exec prettier <改动文件> --write`，随后 `pnpm exec eslint <源码文件> --fix --fix-type layout`；运行两份 tsconfig 的类型检查、`pnpm build` 和 `pnpm format:check`。
- [x] 真实浏览器验收分类、模板标签、GitHub 名称、日历慢加载/失败/重试/两轮/反向/回焦与减少动效；真实编码合成头像，比较前后尺寸、体积与透明度。
- [x] 同条件运行优化后 Lighthouse，记录性能指标和首屏实际资源差异；将方法、结果与局限写入对应 acceptance 文档及防回归清单。
- [x] 清理临时脚本、测试数据、浏览器和服务，检查 `git diff --check`、400 行上限及最终变更；完成后交用户审查，不 commit 或 push。
