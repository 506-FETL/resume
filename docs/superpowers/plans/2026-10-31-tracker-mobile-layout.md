# 求职跟进移动端实施计划

**目标：** 手机只显示列表，以职位和下一步安排为中心。最新用户要求替代同轮早先的手机看板方案。

**架构：** 现有 React + Zustand 页面、shadcn 组件；桌面 CrossListDragProvider 不变；仅小于 768px 的布局与导航变化。当前分支实施，不提交或推送。用户已批准方案 A，无需重复确认。

**技术：** React、TypeScript、Tailwind、Motion、Zustand。遵守现有格式、公共动效及数据隔离。保留所有既有未提交改动。

## Task 1：移动端页头与工具栏

- [x] 修改 header / overview-bar / toolbar，24px 标题+新增，数量/响应率作为辅助行，移除重复统计与手机视图切换。
- [x] 手机列表使用阶段导航，显示菜单仅保留排序和公司分组。搜索、公司及三个工具图标继续直达。
- [x] 现有 Button / Tabs / Input / CompanyPicker / Tooltip 足够，不新增原生表单与自建浮层。桌面 DOM、布局及统计逻辑不变。
- [x] 局部 Prettier 与 ESLint layout；报告自审结果。

## Task 2：移动列表与职位信息

- [x] 撤销本轮手机看板改动，正式看板文件恢复开工快照。
- [x] 手机主页面、工具栏、加载骨架、批量全选统一列表语义，不覆盖桌面 viewMode 偏好。
- [x] 新增全部 / 待跟进快捷筛选，八阶段放下拉菜单；常驻支持空结果恢复，复用 Tabs / DropdownMenu 和本地筛选。
- [x] 强化手机职位名、公司、真实下一步与日期层级，复用详情抽屉及原业务动作。
- [x] 动效使用公共预设与减少动效，检查焦点、键盘、筛选和选择范围。

## Task 3：验收与复盘

- [x] 在 tests/tracker-mobile-layout 下创建临时隔离数据入口，使用正式组件和合成职位，不改用户数据；完成后删除。
- [x] 截图与实际交互验证手机、桌面边界、深浅色、空结果、多职位、长字段、返回、筛选、批量范围及减少动效。
- [x] 独立审查本次增量，修复重要发现；检查新增控件、文案和过渡。
- [x] pnpm exec tsc -p tsconfig.app.json --noEmit；pnpm build；pnpm format:check；git diff --check。
- [x] 更新防回归清单及验收记录，区分实施完成、技术验证、待用户审查。
