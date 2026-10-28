# 内容切换残留与模板预览入场修复

日期：2026-10-26。范围由用户明确授权：岗位抽屉页签与阶段内容、创建简历步骤、模板预览打开。保留既有布局、业务数据和组件库。

## 根因与实测

- 岗位 DrawerTabPanel、阶段 ViewTransition 和创建向导都在 popLayout 中同时执行旧内容淡出与新内容淡入。实际逐帧采样确认创建步骤和岗位页签存在同一区域两组非透明文本；排除嵌套轮次面板后，岗位页签一次采样有 7 帧新旧外层同时可见。
- 模板目录顶层订阅整个 useTemplatePageStore。打开、关闭和切换示例都引起目录重新渲染，并触发带 layout 的目录卡片测量；模板正文同时挂载并开始模板解析和分页。
- 卡通贴纸预览的本次开发环境采样包含 242 ms 和 198 ms 的长任务。浏览器自动化采样也有约 1 秒间隔，不能将所有间隔当作应用耗时或据此宣称固定帧率。

## 修复设计

1. 仍立即挂载新面板以初始化和测量目标布局，旧面板脱离布局并按 DURATION.fast 退出。新内容的可见进入与退出时长衔接，避免文本交叠。退出显式取消进入延迟，快速反向切换不会等待旧延迟。保留退出 inert / aria-hidden、焦点交接和草稿保存；减少动效归零。
2. AnimatedContent 仅新增可选进入延迟，默认行为不变；创建向导按共享退出时长传入。tracker 的本地面板使用相同规则，不改全局 Dialog 或 Drawer 动画。
3. 模板预览容器独立订阅预览状态；目录只订阅筛选条件。保持预挂载关闭状态的弹窗，保留首次打开和重复打开的 primitive 动画。
4. 预览先复用已解码静态图，必要资源继续加载。完整正文构建与分页等待当前外框动画实际完成，不使用固定超时；关闭或反向切换时重新核对动画生命周期。减少动效立即展示。失败继续展示真实错误与重试，不吞错误，也不修改测量、打印或 PDF 协议。

## 复用与边界

复用现有 AnimatedContent、PresenceDiv、Dialog / Drawer、useReducedMotion、DURATION / EASE 及 ScaledReadonlyPreview。页面已有组件足够；无新增依赖，无新 UI 控件。参考 [Motion AnimatePresence](https://motion.dev/docs/react-animate-presence) 与 [Element.getAnimations](https://developer.mozilla.org/en-US/docs/Web/API/Element/getAnimations)。

验收包含实际页面多轮切换、快速返回、焦点及草稿未改动、两轮完整打开关闭、退出中再次打开、首开与缓存后打开、示例切换、390 px 与减少动效。所有采样脚本仅放 tests，证据保留在 .superpowers/sdd/phase-three-20261026。
