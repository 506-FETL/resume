---
version: 1
slug: 'src-app-tsx'
primary_target: 'src/App.tsx'
related_targets:
  ['src/components/layout/dashboard-shell.tsx', 'src/pages/index/index.tsx']
---

# 全站应用界面

范围：GResume 应用外壳与 17 类页面；Operate 为主，日志/公开分享为 Read。用户已批准「专注编辑」及全站设计规格，文档正文与打印不变。

## Direction contract

THESIS: 把正在编辑的文档、跟进的岗位和待处理问题放在最前，避免每个模块都用同等重量的大卡争夺注意力。

OWN-WORLD: 黑白中性表面，连续浅色侧栏，单层文档容器和信息行，24–28 px 页面标题、16–18 px 对象标题、14 px 正文；三提醒与 ATS 沿用已确认语义色及局部装饰。

STORY: 用户先辨认对象，再读必要状态，直接继续编辑、处理待办或查看岗位；统计与动态只提供辅助依据。真实操作、加载/失败/空态与数据边界保持。

FIRST VIEWPORT: 桌面左侧连续导航，右侧标题及右上创建按钮；最近简历两块轻量容器，紧凑三提醒，下方待办宽栏与统计动态窄栏。手机依次单列，工作区保留原看板、三页签抽屉和居中编辑器工具栏。签名交互是当前对象的明确选中态与轻量切换；复用既有 Motion 预设及减少动效，不新增装饰循环。

FORM: 编辑校对的主稿与旁注，推荐候选「专注编辑」，用户选定；code-led。seed:2195b55a04c6613b

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
