# 创建信息、简历搜索与求职浮层实现计划

> 按 executing-plans 逐项执行，独立模块按 dispatching-parallel-agents 分工。用户已授权本期，当前分支、不提交不推送。主代理负责集成、浏览器和数据库部署验收。

**目标：** 模板选择后填写名称与描述，简历库完整搜索，求职弹层稳定且逐层关闭。

**架构：** 扩展现有创建草稿及稳定的模板工作区；搜索纳入现有 library 分页缓存与查询；浮层先测量实际布局和关闭原因，再在对应共享边界修正。

**技术栈：** React、Zustand、Motion、既有 shadcn / Radix / Base UI、Supabase、pnpm。

## 任务 1：创建流程（history_scroll）

文件：create-resume-card 的 index、types、utils、store、hooks/use-creation-flow、components/template-picker；新增 components/resume-details/index.tsx；src/lib/resume-preparation/types.ts。

- [x] 阅读旧创建修正、草稿、准备及持久化路径，确认已有 Input / Textarea / Field / Button 与模板资源可复用。
- [x] 增加 details 步骤，template / details 使用相同外层工作区 key，页脚分别为下一步与创建，返回保留目录和草稿。
- [x] 在草稿入口用缺省值补齐旧草稿；显式空字符串保留。默认名称为示例简历，描述为空。
- [x] 提交时使用以下归一化，并将两字段冻结进 creation，重试只用冻结内容；保留原操作 ID、账户检查和顺序。

```ts
const displayName = draft.displayName.trim() || '示例简历'
const description = draft.description.trim()
```

- [x] 同一选中卡连续变换为铺满左侧的背景，其他卡退出与右侧表单进入衔接；详情态取消描边、勾选与名称条，背景从左向右渐隐，深色与弹窗底色相融。使用 DURATION / EASE 与 useReducedMotion，提前交接焦点。手机背景从顶部向下渐隐，短屏正文滚动、页脚固定。此项依用户实际页面审查修正，最终视觉验收单列于任务 4。
- [x] tests/resume-workflow/creation 用真实组件、真实创建准备与合成持久化边界，提供实际页面入口，执行局部格式与 layout；流水线 5 项通过。页面字段、返回与动效在任务 4 继续验收。

## 任务 2：完整搜索（pagination）

文件：src/pages/resume/index.tsx、store/library.ts、相关 UI slice；src/lib/supabase/resume/library.ts、src/lib/offline-resume-manager.ts 及必要的轻量查询帮助模块。数据库变化由主代理负责：迁移 20261111101413_resume_library_search.sql 新增 search_resume_library_counts(uuid,text) 与 search_resume_library_page(uuid,text,text,integer,integer)。两者使用 strpos / lower 做字面包含、SECURITY INVOKER 与 auth.uid() 归属，旧未搜索接口不变。分页函数显式返回 11 个列表摘要字段，JD 在数据库侧裁成 80 字片段，不读取完整正文，最大 10 项。

- [x] 搜索输入复用已有 InputGroup 与清空动作，名称或描述片段匹配；输入法组合期间不查询，结束后短防抖，清空立即恢复。
- [x] 查询条件与统计条件一致，下推云端；本地增加名称和描述键索引，用 openKeyCursor 取得匹配 ID，再与已有顺序和分类交集，兼容原数据库版本升级。每批最大 10 项、更新时间 / ID 顺序和云本地合并不变。
- [x] 按查询词隔离成功页和在途请求；可从已完整加载摘要推导，但不可把当前页当全库。查询变更回第一页，原分类继续有效。
- [x] 失败保留旧结果且不缓存为空；空匹配提供清空入口；写后失效、A→B→A、旧响应与 finally 隔离继续使用原机制。
- [x] 扩展真实 slice 与 SDK 边界验证：23 条跨页、描述唯一命中、字面特殊字符、缓存回访、快速查询、失败重试和写后重读。额外修复身份初始化的首屏双读，真实页面 effect 5 项通过。

## 任务 3：求职浮层（loading_hints）

文件范围：真实复现所指向的 src/components/ui/combobox.tsx 或 portal-container.tsx、src/pages/tracker/components/drawer/index.tsx；必要调用点按具体证据调整，不重写全局浮层。

- [x] 用 tests/workspace-controls/tracker-overlays 提供真实 AddJob / JobDrawer / SubmissionDialog 隔离入口，主代理记录弹窗网格行、尺寸与打开 / 关闭状态。
- [x] 确认 Portal 包装层引入网格间距后，使浮层挂载节点脱离普通布局；保留定位基准、滚动锁、焦点与减少动效。
- [x] 记录嵌套 Dialog 操作导致 Drawer 关闭的实际 reason 与事件路径，保护当前上层的交互；继续允许正常外部点击与逐层 Escape，不粗暴禁用全部关闭行为。
- [ ] 实测职位 / 公司 / 城市、Select 对照和嵌套日期 / 投递来源 / 简历 / 版本，完成两轮开关与快速反向、确认 / 取消回焦，执行局部格式与 layout。

## 任务 4：集成与交付（主代理）

- [ ] 审查三组修改，按 review-animations 复核创建连续性与动态减少动效，检查 320 / 390 / 768 / 1024 / 1440px 以及 400px 短屏。
- [x] 搜索迁移在当前已链接项目部署，隔离 SQL 13 项 / REST 3 项及线上 13 组通过，云端账本与权限核对完成；合成账号及关联数据已清理。
- [ ] 在既有分页、筛选、历史滚动检查基础上，复核新增搜索未挤掉列表和固定页脚，类型与生产构建仍通过。
- [x] 运行 pnpm exec tsc -b --pretty false、pnpm build、pnpm format:check、git diff --check；最终全部退出 0，68 条既有 lint warnings 和原构建分包提示保留。
- [ ] 更新防回归清单与验收记录，明确实施完成 / 验证通过 / 用户审查待进行，清理临时 tests、数据、服务与凭据，保留截图。
