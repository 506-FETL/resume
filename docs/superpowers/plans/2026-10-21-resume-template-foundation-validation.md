# 默认模板首期实施与验收记录

实施起点：`238a4e0f8e66acefa3afd2f4e49878db275cb21d`，分支 `refactor/template`。

## 基线

- Node.js：v24.12.0；pnpm：10.33.3。
- 实施前工作区干净。
- 实施前 `pnpm exec tsc --noEmit -p tsconfig.app.json`：通过。
- 原 `verify:collab` 及其评论脚本缺失；使用专项脚本与交互验证，缺失项不计为通过。
- 固定样本：`scripts/fixtures/resume-template/all-sections.json`；参考日期 `2026-10-21`，包含隐藏和空条目、富文本块、中文／英文／emoji。
- 固定评论投影：`scripts/fixtures/resume-template/projection-baseline.json`。
- 浏览器基线与导出证据存放在已忽略的 `.superpowers/template-baseline/`。

## 进度

任务 1：数据和投影基线通过，浏览器默认 DOM、尺寸与截图已固定；生产构建通过（18.86 秒，有原有分包体积提示）。PDF／Word 的实际应用检查在任务 12 完成。其余任务进行中。

## 默认渲染检查点

- 任务 2～5 专项校验与 TypeScript 检查通过。
- 浏览器固定样本 69 个标题／评论字段节点：文本、位置、尺寸、字体、颜色及总高度与原基线完全一致。
- 保留旧运行时空模块占位对 flex gap 的影响；未借重构修改默认间距。
- 分享信封的读取适配器因运行时迁移依赖提前在任务 5 建立，发布序列化仍在任务 10 接入。
