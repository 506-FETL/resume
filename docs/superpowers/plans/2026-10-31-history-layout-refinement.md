# 历史版本布局优化实现计划

**目标：** 提高版本导航密度与详情主次，保留开放布局和真实预览。

**架构：** 沿用 history 页面模块和数据 store。时间线只调整呈现；详情以 Collapsible 替代互斥信息页签，预览常驻；局部 UI 状态仍由现有详情 hook 管理。状态获取、恢复、删除和导出业务保持原流程。

**技术栈：** React、Zustand、Tailwind、现有 shadcn/Radix 与 Motion。

- [x] 时间线：调整 timeline/index.tsx、current-version-card.tsx、version-card.tsx、loading-state.tsx；压缩重复信息与分隔，保留日期分组和选中状态。
- [x] 详情：调整 detail-header.tsx、detail-content.tsx、use-detail-panel-state.ts、current-overview.tsx、history-overview.tsx、loading-state.tsx；组织身份摘要、辅助信息、编辑及预览，复用 Collapsible。实际深色检查后同时清除 detail-panel/index.tsx 和时间线容器的残留底色。
- [x] 操作：扩展 history-action-button 的紧凑展示，导出按钮仅透传展示选项；对比、恢复、编辑和取消真实路径不变，保留手机 36px 图标同排。
- [x] 验证：在 tests/history-layout-refinement 中挂载正式组件与内存样本，覆盖规格场景；实际页面只读复核。检查预览实例、焦点、溢出及控制台；临时文件已删除，证据放 .superpowers/history-layout-refinement/。
- [x] 完成：修改文件执行 Prettier → ESLint layout；类型检查、构建、format:check 和 diff --check 均通过，不提交或推送。

实施完成，验证通过，最终用户审查待确认。详细结果与范围限制见[验收记录](../specs/2026-10-31-history-layout-refinement-acceptance.md)。
