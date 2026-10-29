# 全站界面与动效精修实现计划

> **面向 AI 代理的工作者：** 使用 subagent-driven-development 分任务实现并审查；用户已授权按推荐方案直接落地，不再重复等待批准。

**目标：** 全面审查并改善 17 类页面的层级、颜色、文案和全部交互过渡，修复实际状态、退出、焦点及窄屏问题。

**架构：** 保留现有 PageLayout、shadcn/Radix/Base UI、MotionProvider 和页面 store。公共组件修复影响全站，业务页面分别优化，保留现有数据与导出契约。动画按交互设计，以明确 CSS 属性和现有 Motion 封装实现，不引入无实际需求的 GSAP 时间轴。

**技术栈：** React 19、TypeScript、Tailwind 4、Motion、Zustand、现有 shadcn 封装。

**规格：** [全站界面与动效精修](../specs/2026-10-28-frontend-refinement-design.md)。

## 全局约束

- 当前分支工作，不 commit 或 push，不触碰用户已暂存的 `.trae/skills/` 删除。
- 保留首页局部渐变、ATS Racing Sans One 分数水印、居中编辑工具栏和手机图标形式、跟进看板/列表与三页签抽屉。
- 保留字体、分页、打印快照和数据隔离；不更改用户简历、岗位、分享和会话数据完成验收。
- 动效时长使用 DURATION.fast/base/slow 与 EASE.out/in，减少动效接入现有变量和 useReducedMotion。原文定位高亮的特定例外按防回归清单处理。
- 常见交互读取 transitions-dev 的对应 reference，按本仓库状态协议与 tokens 适配；审查使用 review-animations/STANDARDS。不存在复杂时间轴时不增加 GSAP 依赖。
- 仅为实际需要建立局部组件，不批量重构目录。临时验收脚本放 tests/ 并在结束后删除。

## 任务 1：公共控件的状态与细节动画

文件：`src/components/ui/{switch,checkbox,command,field,button,tabs}.tsx`、`src/components/ui/sidebar/sidebar.tsx`、`src/styles/motion.css`。

- [x] 读取 transitions-dev 的 25-checkbox-check、27-toggle、16-tabs-sliding、17-tooltip、05-menu-dropdown、06-modal，并以 review-animations 检查目标属性、起点、进入/退出和打断。
- [x] 修复 Radix 状态，Command 只匹配 true，Field 同时兼容实际使用的 primitive。

```tsx
// Radix 使用值选择器，不能将属性存在当成选中。
'data-[state=checked]:bg-primary data-[state=unchecked]:bg-input'
'data-[selected=true]:bg-muted'
```

- [x] Checkbox 的边框/底色过渡与勾选淡入分开；Switch 轨道颜色和滑块 translate 连续过渡，保留键盘和表单语义，不重造 primitive。
- [x] Button 与控件将 transition-all 改为各自明确属性，时长使用公共变量。Sidebar 保留 drawer-popup 标识，使进入/退出共享时长真正生效，读屏名称中文化。

```tsx
'transition-[color,background-color,border-color,box-shadow,transform] duration-(--ui-motion-fast) ease-(--ui-motion-enter-ease)'
```

- [x] Tabs 根据已有 value/defaultValue/onValueChange 建立可中断的活动指示器，兼容横向/纵向和 line/default；首次布局直接定位，尺寸变化不从零滑入；内容切换避免新旧正文同时可见和重复动画，forceMount 的既有工作区自行管理。
- [x] 临时控件验收检查 checked/unchecked/indeterminate/disabled/focus，Tabs 方向键与连续切换，减少动效最终状态。样式状态使用浏览器实际属性和 computed style 断言。

## 任务 2：管理页面的布局、颜色与内容层级

文件：`src/pages/index/components/getting-started/index.tsx`、`src/pages/index/components/job-priorities/index.tsx`、`src/pages/resume/{index.tsx,components/resume-card/index.tsx,components/head-bars/index.tsx}`、`src/pages/template/components/template-card/index.tsx`、`src/pages/optimize/components/dashboard/overview-summary-card.tsx`、`src/pages/optimize/components/repair-checklist/index.tsx`、`src/pages/optimize/components/advanced-tools/shared/config.ts`、`src/pages/history/components/timeline/empty-state.tsx`、`src/pages/changelog/content/2026-08-13.mdx`。

- [x] 游客已有简历时只保留紧凑本地保存说明和同步入口，无简历才展示完整教程；移除 allHref 未使用声明的真实根源。

```tsx
if (hasResume) {
  return (
    <section aria-label='本地保存说明'>{/* 具体说明与登录同步入口 */}</section>
  )
}
```

- [x] 简历卡按内容收紧高度，统一“本地/云端”“原始简历/岗位版本”的用语，保留长名称和操作空间。
- [x] 模板卡拆为纸张比例缩略图与常驻名称/分类，详细介绍按需展示；触屏直接可识别，保留现有资源预取与延迟预览。
- [x] 优化摘要保留大分数与渐变，一条主要结论优先，画像/协议移入依据；右侧清单保留操作与进度，避免重复一整段问题。辅助工具删除无效英文包装。
- [x] 历史空态用具体保存场景和既有按钮；旧更新日志追加当前分享契约的日期说明。
- [x] 按各页读图顺序检查中性文字、状态颜色、边框与留白，不删用户确认的模块特色。

## 任务 3：编辑器、跟进与自定义动画

文件：`src/pages/resume/editor/index.tsx`、`src/pages/resume/editor/components/toolbar/index.tsx`、`src/pages/resume/editor/components/forms/`、`src/pages/resume/editor/hooks/use-scroll-sync.ts`、`src/pages/tracker/hooks/use-count-up.ts`、`src/pages/tracker/components/focus-button/index.tsx`、`src/pages/resume/editor/components/check-highlight/index.tsx` 及实际高亮封装。

- [x] 编辑面板退出先交还焦点并隔离交互，保留已有入口；小屏仍为图标按钮，增加可点击区域与分组间隔，自然换行，不修改正文比例。
- [x] 表单条目删除加入存在性与占位过渡，复用 PresenceDiv/PresenceListItem；删除后焦点进入相邻有效项或添加入口，快速撤回无双重跳位。
- [x] 统计从当前显示值继续变化，取消时不写成旧目标。采用现有快档时长，首帧直接真实值。

```ts
const progress = Math.min(1, (now - start) / duration)
const nextValue = Math.round(from + (target - from) * eased)
currentValueRef.current = nextValue
setValue(nextValue)
```

- [x] 协作滚动在当前容器范围内截取目标，减弱动效直接定位；不等长容器和超界目标能够停止，停止跟随/卸载取消帧。
- [x] 原文高亮只为指定 animate=true 路径保留一次划过，其他组件继续遵守减少动效；不放宽全站媒体规则。
- [x] 跟进看板列宽、工具栏和业务布局保留，逐项检查浮层、切换、批量、关注和面试轮次动画；删除未使用 TooltipContent。

## 任务 4：助手的引用、状态与布局

文件：`src/pages/assistant/components/composer/index.tsx`、`src/pages/assistant/components/message-bubble/`、`src/pages/assistant/components/chat-header/index.tsx`、`src/pages/assistant/components/conversation-list/`、`src/pages/assistant/store.ts`、`src/pages/assistant/utils.ts` 及上下文现有 types。

- [x] 将新建引用的可见名称与模型身份分开，输入区显示可移除引用，提交时保留原有上下文语义；历史只做展示适配，不改写已保存原文。
- [x] 会话标题中的系统引用前缀做明确解析，只处理项目已知格式，不泛化删除普通用户文字。
- [x] 输入、消息、修改预览检查 320/390 px 可用高度、长文本与工具结果；停止、深度思考、编辑消息复用现有 Button/Textarea。
- [x] 引用增删、工具展开、推理展开与流式内容分开设计，文本 token 不重复触发消息入场。

## 任务 5：认证、资料、公开状态和品牌

文件：`index.html`、`src/components/dashboard/app-sidebar.tsx`、`src/pages/{login,sign-up,forgot-password,reset-password}/components/`、`src/pages/profile/components/{account-settings-card,readonly-field,session-info}/index.tsx`、`src/pages/share/view/components/centered-message/index.tsx`、`src/pages/share/view/index.tsx`、`src/pages/[...all].tsx`。

- [x] 页面语言设为 zh-CN，标签与侧栏统一现有 GResume 名称，不增加新标志。
- [x] 认证字段加入正确 autoComplete，现有校验限制提前可见；错误在入口统一成具体中文，成功态保留返回登录/修改邮箱的实际操作。
- [x] 会话信息直接复用父级已加载用户，删除冗余网络请求及可能永久停留的骨架；静态字段改为可阅读的信息行。该方案消除了第二个失败源，不再额外建立重复请求的重试状态。
- [x] 404 移除 Globe/LightRays，保留简短原因和真实返回入口；失效分享补充联系分享者说明，不添加无效重试。
- [x] 状态间复用 AnimatedContent，已有表单错误与加载保留适当过渡；深浅色和小屏检查完成态。

## 任务 6：全站动画二次遍历与共同布局

文件：`src/App.tsx`、`src/components/layout/dashboard-shell.tsx`、`src/components/motion/`、`src/styles/motion.css`、剩余实际命中的页面与共享组件。

- [x] 检索全部 transition、animate、AnimatePresence、requestAnimationFrame、scrollTo 与 setTimeout 驱动过渡，记录每种触发、进出、打断、焦点、减少动效和性能结论；不只搜已有动画，还检查条件渲染/增删是否缺少过渡。
- [x] 消除没有用途的多层入场；重取保留内容，语义状态变更才切换；只对实际可见列表做有限 stagger，不把全列表拖慢。
- [x] 浮层检查 origin 来自触发点、退出无延迟、同一组件二次打开仍正确；旧新内容不叠字，隐藏节点不可交互。
- [x] 保持表单同步边界和模板懒加载，不用动画等待掩盖异步失败。

## 任务 7：验证、独立审查与交付

- [x] 改动代码先 Prettier 再 ESLint layout fix；执行 `pnpm exec tsc -b`、改动文件 lint、`pnpm build`。不为处理已有无关 warning 扩大范围。
- [x] 浏览器与源码逐页矩阵：17 类路由，主要页面 1440/390/320，编辑/助手补 1024/768；深浅色与 reduced-motion 抽查。每页的真实状态、改动和保留理由见验收记录；不宣称覆盖所有后端和主题组合。
- [x] 控件实际交互：Switch/Checkbox/Command/Tabs；弹窗创建简历/分享/优化；抽屉编辑器/跟进/手机侧栏；两轮开关及反向切换，记录中间帧、焦点和最终状态。
- [x] 以隔离合成数据检查列表新增/删除/重排、计数打断、滚动超界和认证错误恢复；资料实测编辑/取消焦点，未发送账户更新。临时测试全部放 tests/，删除时仅删除本轮创建文件。
- [x] 编辑器普通字段、富文本输入与粘贴各 10 秒，合成中文组合事件、长文、保存与真实导出末尾内容；方法和限制见验收记录。本轮未改模板正文布局，额外发现的空模块跨页问题单列为未通过项。
- [x] 独立审查本轮 diff 的规格与质量，使用 review-animations 做最终动效检查，再用 Impeccable critique/polish 复核布局、颜色和文字。
- [x] 更新防回归清单与验收记录，记录真实未覆盖项，不将浏览截图等同功能验收；不推送远端。

## 进度

- 初审：独立设计、检测与动画源码审查完成，确认问题均已处理或按已确认偏好保留。
- 实施：七项计划已落代码；补齐实时减少动效、历史常驻页签、评论关闭焦点和主题中断清理。
- 验证：控件、关键浮层、三类工作区组合、输入性能与导出最新文字已完成；最终类型、lint、构建和格式检查结果见验收记录。
- 未通过项：默认模板 v3 空模块标题/分隔线跨页，未修改模板算法，已记录复现与后续验收要求。
- 最终用户审查：尚未进行，不能由代理代为确认。

[详细验收、逐页覆盖与限制](../specs/2026-10-29-frontend-refinement-acceptance.md)。
