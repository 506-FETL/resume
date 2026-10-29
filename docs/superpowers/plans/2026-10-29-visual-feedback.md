# 八项视觉反馈修正计划

> 面向 AI 代理：使用 subagent-driven-development 拆分独立模块；主代理负责创建向导、共享入口及整体浏览器验收。

**目标：** 完成用户八项反馈，保留现有业务功能。

**架构：** 页面重排与局部组件修正，继续使用现有 store、shadcn 与公共动效；不新增依赖。

**技术栈：** React、TypeScript、Tailwind、Motion、Radix、Zustand、pnpm。

## 全局约束

先读 AGENTS.md、docs/product-development-guardrails.md 和同日 visual-feedback-design.md。当前分支、不提交、不推送，保护所有已有改动。使用现有组件；动效使用 src/lib/motion.ts 和项目 useReducedMotion。不得改变业务 store、用户正文、模板几何、后端与打印。用户八项反馈是本期修订授权，不重复请求实施确认。子代理不操作浏览器；主代理统一验收。测试夹具只在 tests/visual-feedback，结束删除。

## 任务 1：首页（对应 2、3）

范围：src/pages/index/index.tsx、components/job-priorities、insight-cards、statistical-card、entry。

- [x] 用完整轻容器承载三个提醒，保留语义色、淡图标、渐变和全部状态/动作。
- [x] 将长侧栏改为分行布局：待办/概况、三张图表、快捷/动态。复用原组件，需要 Entry 局部布局选项时用明确 variant，不复制数据计算。

```tsx
<div className='grid items-start gap-6 lg:grid-cols-3'>
  <FunnelCard {...funnelProps} />
  <AtsTrendCard {...trendProps} />
  <ActivityCard {...activityProps} />
</div>
```

- [x] 各模块原加载/失败判断完整迁移；不创建跨模块共享 loading。
- [x] 本任务文件 Prettier、ESLint layout，报告源码审查与测试边界。

## 任务 2：优化页和模板筛选（对应 6、7）

范围：src/pages/optimize/index.tsx、dashboard/assessment-basis-card.tsx、scores-radar-chart.tsx、repair-checklist（如确需）；src/pages/template/components/template-filters/index.tsx。

- [x] 将评分依据与雷达组织为同一个自然高度区域，展开参考内容占满宽度，不再双列互相撑高。可为 radar 增加明确的嵌入模式，复用同一图表数据。
- [x] 问题/处理清单动作全部保留；摘要用响应式网格收紧分数、说明和可读性，首次无报告不重复展示空雷达，雷达加载占位缩至 min-h-24。
- [x] 手机使用现有 Select，选项受浮层最大高度约束；桌面保留按钮组。选值继续调用 setStyleFilter/setLayoutFilter。

```tsx
<Select
  value={value ?? 'all'}
  onValueChange={(next) => onChange(next === 'all' ? null : next)}
>
  <SelectTrigger aria-label={title}>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value='all'>{all}</SelectItem>
    {/* 真实 facets */}
  </SelectContent>
</Select>
```

- [x] 本任务文件 Prettier、ESLint layout，报告状态分支与数据边界。

## 任务 3：三类简历（对应 1）

范围：src/pages/resume/components/resume-card/index.tsx 与 const.ts；不编辑创建向导或首页。

- [x] 恢复 RESUME_CARD_APPEARANCE 中的类型色，图标底色与 Badge 联动；保留类型名称，不只用颜色。
- [x] 岗位版本优先判定、显示真实存储位置；来源/生成/错误/模板/菜单动作保留，收紧 min-height 空白。

```tsx
const tone = isVariant ? 'variant' : resume.isOffline ? 'local' : 'cloud'
```

- [x] 本任务文件 Prettier、ESLint layout，核对本地/云端/岗位三分支。

## 任务 4：向导、AI 入口、星标（主代理，对应 4、5、8）

- [x] 采样创建向导现有步骤尺寸和文字叠帧；修改 src/pages/resume/components/create-resume-card/index.tsx，使标题/正文/页脚在单层 Presence 中同步切换，尺寸测量不读视觉缩放。
- [x] 按本轮用户修订取消全幅高饱和渐变。assistant-entry 组合原 SidebarMenuButton/Link、中性背景、40px 高度、细边框与小紫色图标；悬停/聚焦轻转图标并显示箭头，保留 from、当前页及手机关闭行为。
- [x] GithubStars 使用 SlidingNumber 每位 spring 的真实完成回调，结束后图标一次缩放回落和填色；site-header 复用该图标，减少动效直接到目标值且关闭后不从 0 重播。
- [x] 不用固定 timer 猜测数字完成；不修改共享 Dialog，除非复现证据证明共享层才是根因。

## 任务 5：集成与交付

- [x] 主代理逐任务审查 diff，覆盖八项规格及原数据/动作。
- [x] tests/visual-feedback 使用真实组件、隔离合成内容；测三种卡片、长选项、向导步骤、计数更新、运行中减少动效。
- [x] 桌面和手机真实页面；整页、折叠/展开；两轮弹窗与快速反向，检查焦点、控制台、边界采样与残留。
- [x] `pnpm exec tsc -b`、`pnpm build`、`pnpm format:check`，记录 exit code，失败修后再跑。
- [x] 使用 review-animations 和独立最终审查，按实际证据修复；更新防回归清单和设计规范。
- [x] 删除本轮 tests/visual-feedback，保留本地证据，交付八项结果和明确边界，用户最终审查单独记录。

## 收尾记录

实施与针对性验证已完成，临时夹具已清理。类型检查、生产构建、本轮文件格式通过；全项目格式检查仍有 8 个范围外文件不通过及 69 个 ESLint 警告，未扩大修改范围。桌面/手机、向导两轮开关与反向、星标完成时机等实际证据及验证边界见[验收记录](../specs/2026-10-29-visual-feedback-acceptance.md)。最终用户审查待确认，未记为通过。
