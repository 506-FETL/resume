# 当前简历更换模板实施计划

> **面向 AI 代理的工作者：** 使用 subagent-driven-development 按任务实施，结合独立审查。用户已授权直接执行，不再请求审阅；当前分支工作，不提交、不推送。按仓库约定不采用 TDD 流程，验收脚本完成后移出 tests/。

**目标：** 从模版设置预览并应用任意上架模板，保留当前内容及外观，支持安全撤销、协作更新和离线缓存。

**架构：** 页面级 Zustand 管理选择、会话和单步撤销；资源复用现有 TemplateSource、模板定义和图片缓存。独立候选预览以真实分页状态作为应用门禁，正式写入只修改 templateBinding，沿用现有持久化与 Automerge。

**技术栈：** React、TypeScript、Zustand、Radix Dialog/Select、Motion、Automerge、现有声明式模板运行时与分页打印。

## 文件责任与全局约束

- `src/pages/resume/editor/template-switch/{store.ts,types.ts,utils.ts}`：会话、候选、冲突提示、受保护的应用/撤销和照片节点识别。
- `src/pages/resume/editor/hooks/use-template-switch-session.ts`：绑定表单/只读状态的生命周期订阅。
- `src/pages/resume/editor/components/template-switch-dialog/index.tsx`：大弹窗和移动端切换、页数、按钮门禁。
- `src/pages/resume/editor/components/template-switch-gallery/index.tsx`：独立目录分页、筛选、卡片及缓存缩略图。
- `src/pages/resume/editor/components/template-switch-preview/index.tsx`：真实内容预览，最多两份文档，候选与内容版本隔离。
- `src/pages/resume/editor/components/toolbar/template-settings/index.tsx`：主题选择、当前模板、更换与撤销入口。
- `src/pages/resume/editor/components/toolbar/index.tsx`：挂载设置组件，保留用户刚修改的「模版」文字。
- `src/lib/resume-template/source/{types.ts,remote.ts}`：如需单项当前目录信息，增加精确目录读取与已有缓存整合，不变更数据库。
- `src/pages/resume/editor/template-switch/const.ts`：独立目录 store 复用 createTemplateResourceStore，共享底层 source；定义缓存仍用全局 useResumeTemplateStore。
- `tests/resume-template-switch/`：临时功能、浏览器和 PDF 验证，不添加 tests 外的验收脚本。
- 本文与对应设计规格：需求、执行进度和最终验证证据。不修改公共打印/分页实现，不扩展不相关页面。

## 任务 1：模板应用与撤销领域逻辑

- [x] 检查 form/document/sync-service 的会话、绑定更新和持久化语义；建立页面 store，记录会话键、open、selected binding、远端变化提示和 lastUndo。
- [x] 对外提供 open/close/select/apply/undo 与 synchronizeSession；apply 接受已经就绪的精确候选和当前内容签名，重新读取 live state 验证，不接收可覆盖全表单的旧快照。

核心写入顺序：

```ts
// 相同事件循环中完成校验和写入，不等待网络保存。
if (!sameSession || readOnly || !previewReady || selectedKey !== readyKey)
  return false
const previous = live.templateBinding
live.setTemplateBinding(selectedBinding)
// 仅在绑定确实更新时记录撤销。网络同步失败与本地更换失败分别处理。
recordUndo({ previous, applied: selectedBinding, operationId, sessionKey })
```

- [x] 撤销按操作 ID、会话和当前 applied 绑定作条件写入，消费记录；远端模板变化清除旧记录，内容/外观变化不清除。
- [x] 照片能力递归扫描 document/section/contentByKind 及区域覆盖中的 photo 节点；不基于模板 ID。
- [x] 在 tests 下验证只改绑定、保留期间编辑、过期撤销、远端模板改变、会话切换和只读门禁。记录验证输出并进行任务审查。

## 任务 2：模板资源与候选列表

- [x] 目录采用独立 createTemplateResourceStore(resumeTemplateSource)，避免改变模板库页面筛选；定义及图片仍使用共享缓存。
- [x] 补充单项目录查询以读取当前模板名称、分类、最新版本及缩略图。缓存策略与目录 TTL 一致；下架当前项可读，但其他候选来自 listed 分页接口。
- [x] 构建当前版本卡片与分页候选列表，精确引用去重，未筛选置顶、筛选按分类匹配，同 ID 新版保留独立候选与新版标签。
- [x] 卡片使用已有图片缓存和可视区域观察，首次只请求 12 项、底部追加 12 项，错误显示重试。只为选中/当前模板准备真实定义，照片提示以已加载定义为准。
- [x] 核验筛选来回复用请求、空列表、分页失败重试、下架当前项以及旧版与新版并存。

## 任务 3：真实内容预览与设置入口

- [x] 提取 toolbar 的主题菜单到 template-settings，保留用户文字和现有主题行为，新增当前名称、选择按钮和撤销入口。弹窗独立挂载，避免小菜单关闭时一起卸载。
- [x] 以当前 persisted snapshot 和当前配置构造 candidate data，仅替换其中的 binding；不调用模板新建服务，不带入示例。
- [x] 保留上一份 ready 预览；用候选引用、数据、外观组成签名，为最新签名接收分页回调。只有 status=ready 且 signature 非空才允许应用。
- [x] 资源/分页错误保留上份预览并给重试，断网缺缓存显示联网提示。内容或外观协作变更更新候选并使旧就绪证据失效。
- [x] 大弹窗展示页数、照片提示、当前与候选名称；桌面双区、移动端选择/预览切换。应用及撤销 toast 仅报告本地更换，不声称网络已同步。
- [x] 接入现有动效和 reduced motion，处理关闭焦点与快速反向开关；添加 DialogDescription 和键盘语义。

## 任务 4：验证、审查与收尾

- [x] 运行 `pnpm exec tsc -b --pretty false`、针对改动文件 `pnpm exec eslint …`、`pnpm build`，修复本次引入问题。
- [x] 浏览器隔离数据验证：选择取消不变、应用只改绑定、外观保持、编辑后撤销、协作内容更新、远端模板更新提示、重复点击及会话退出。
- [x] 验证资源并发/缓存与完整离线、缩略图缓存但定义缺失的离线失败；实际访问云端目录只做读取，不改变用户简历。
- [x] 桌面/移动两轮开关、退出途中重开、减少动效；检查控制台没有 DialogDescription 和 React 更新循环警告。
- [x] 从真实导出入口获取 PDF：默认/单栏/双栏，短/临界/长内容，背景图形关与开；检查文本、页数和纸张装饰。若遇不稳定，比较实际尺寸、字体和断点，不放宽签名验证。
- [x] 完成独立规格及质量审查，修复有效问题后进行相应回归。
- [x] 将新增 tests 及 PDF 证据归档到仓库外临时目录，删除新增测试目录；在文档写明实际命令、结果、风险与证据位置。

## 执行记录

- 2026-10-23：规格与计划完成。用户已授权跳过再次审阅，直接实施。

- 核心事务、独立目录、候选预览和工具栏已完成；核心领域审查通过。真实浏览器应用/撤销、竞态、外部绑定投影、筛选缓存、离线和移动端验证通过。
- 真实 PDF 矩阵已完成 18 份，三套代表模板全部通过；类型检查、限定 ESLint 和生产构建通过。最终审查发现的键盘菜单可达性问题已修复，真实键盘回归和独立复审均通过。

- 补充目录边界验收通过：首次 12 项、滚动追加到 24 项且下一偏移为 24；隔离缓存注入的同模板新版不会自动应用，确认应用才改精确版本；当前下架项仍显示，风格筛选正确排除不匹配的当前项。
- 最终构建退出 0（16.80 秒），没有新增类型或 ESLint 错误。新增验收脚本及数据已移出 tests，归档至 `/tmp/resume-template-switch-Qt0ZVT/verification-tools/resume-template-switch/`；证据与限制见 `docs/resume-template-switch-validation.md`。
