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
