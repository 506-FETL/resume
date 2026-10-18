# README 流程与图标实现计划

**目标：** 让工具循环可直接顺序阅读，并用准确的手绘图标区分关键节点。

**方案：** 原位精修 SVG；使用图内符号定义复用图标；沿用现有字体嵌入脚本。当前分支内联执行。

## 步骤

- [x] 保存九张图及暂存区基线；核对 `src/lib/ai/agent/agent-loop.ts` 的模型、解析、执行与结果回传关系。
- [x] 重排 `docs/assets/readme/agent-control-plane.svg` 上方流程，留出工具分支空间，向下平移其余面板。
- [x] 精修 `architecture.svg`、`product-sequence.svg`、`hero.svg`、`workflow.svg` 中含义不明确的图标。
- [x] 为 `comment-anchoring-recovery.svg`、`deterministic-a4-pagination.svg` 和 `dual-crdt-collaboration.svg` 的关键节点补齐图标并调整文字位置。
- [x] 使用 `scripts/embed-readme-fonts.py` 更新新增文字的字形子集，检查 XML、字体和符号引用。
- [x] 逐图核验连线、文字与图标边界，保存图像；检查保护文件和暂存区；运行 `git diff --check`。

临时编辑脚本、基线及验收文件保存在 `.superpowers/sdd/readme-icons-20261018/`。不引入业务依赖、不修改页面。

## 验证记录

- 修改 8 张图；技术标签图保持原样。Agent 主流程为 6 个节点、6 条连接，无穿插回流线。
- 9 张 SVG 通过 XML、字体覆盖、图标及箭头引用检查；浏览器逐图目检完成。
- 文字之间及文字与图标之间无边界重叠；图中元素无画布越界；390 px 缩略显示无横向溢出。
- 11 个其他保护文件与暂存区内容未变。README 的命令表格在本轮期间出现独立的空格对齐变化，已单独记录并原样保留。
- `git diff --check` 通过；截图与审计结果已保存。
