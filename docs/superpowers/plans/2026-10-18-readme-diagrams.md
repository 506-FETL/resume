# README 图片精修实现计划

> 面向 AI 代理的工作者：在当前分支内联执行，遵循已确认的 SVG 精修方向。步骤使用复选框跟踪。

**目标：** 修复 README 图片排版并提高缩小展示时的可读性。

**架构：** 以原始独立 SVG 为底稿，保留手绘轮廓、倾斜、图标与曲线，仅做局部文字、箭头尖端和间距修正。真实截图仅调整 Markdown 展示，不改图片内容。

**技术栈：** SVG、Node.js 临时生成工具、浏览器渲染检查。

---

## 1. 基线与视觉参数

- [x] 检查全部 11 张图片，并保存已有 diff 与原 SVG 副本。
- [x] 确认保留手绘风格和 SVG 格式，核对 README 技术说明。
- [x] 保留原纸张、倾斜边框、手绘图标和弯曲箭头；用打字机字体与固定尺寸尖端修复兼容性和比例。

## 2. 产品图与架构图

文件：`docs/assets/readme/{hero,workflow,architecture,product-sequence,tech-badges}.svg`

- [x] 保留 Hero 三栏原画，局部移动云端便签并收拢越界的 AI 星形图标。
- [x] 保留 Workflow 与徽章原图标/轮廓，调整箭头与文字间距。
- [x] 保留 Architecture 节点与 Sequence 泳道，修正标签、箭头和文字遮挡。
- [x] 浏览器检查五张图的文本边界和连线。

## 3. 工程机制图

文件：`docs/assets/readme/{dual-crdt-collaboration,agent-control-plane,deterministic-a4-pagination,comment-anchoring-recovery}.svg`

- [x] 保留原分区，错开标题和说明，修正局部拥挤。
- [x] 保留双 CRDT 的频道/来源标记、Agent 确认与计费分支、分页收敛与评论唯一匹配规则。
- [x] 修正回流路径、结果分组和评论成功分支；保留原手绘箭头形状。

## 4. README 展示与验收

文件：`README.md`

- [x] 将两张产品截图改为上下展示，保留原图片和简短图注。
- [x] 给 SVG 提供点击查看原图入口。
- [x] 使用 XML 解析检查全部 SVG；浏览器检查文本越界、文字碰撞和 1000/820/390 宽展示。
- [x] 保存代表性结果截图；`git diff --check`；比对任务前基线，确保未覆盖既有改动。

本任务为静态文档图片修改，不新增业务测试，不执行与图片无关的应用构建，不自动提交。
