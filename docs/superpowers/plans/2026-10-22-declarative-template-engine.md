# 声明式简历模板引擎实现计划

> **面向 AI 代理的工作者：** 使用 subagent-driven-development 按职责执行任务；主代理整合、检查和完成云端发布。步骤使用复选框跟踪，不在已授权的任务之间重复请求批准。

**目标：** 完成单一声明式模板体系、默认与经典蓝金模板重建、静态目录预览、旧路径删除，以及真实浏览器/PDF/云端验收。

**架构：** 统一内容适配输出带稳定字段身份的内容，严格 v2 协议描述文档树、内容类型配方、命名样式和资源。通用解释器根据作用域绑定内容，统一解析文字与几何参数，再接入四边页边距的 A4 测量、预览、分享和打印。运行时不引入模板定义或模板专属组件。

**技术栈：** 现有 React 19、TypeScript、Zod、Zustand、Vite、Supabase、浏览器 DOM 测量和 react-to-print；不新增网页框架。

**批准依据：** `docs/superpowers/specs/2026-10-22-declarative-template-engine-design.md`，用户于 2026-10-22 明确要求按无旧数据兼容版本实施。

## 全局约束与执行边界

- 当前分支执行，不建分支、不 push；已有暂存修改属于用户，不能覆盖或随本任务整体提交。
- 不执行 TDD 仪式，但为协议安全、内容身份、资源故障和实际输出增加有意义的回归验证。
- 新测试及样本放在 `tests/resume-template/`；维护发布工具放在 `scripts/`。
- 只支持新协议，模板 ID 保留，使用 `default@2` 和 `classic-ribbon@2`；没有旧运行时、旧分享/绑定回退和用户数据迁移。
- 不清空业务数据、账号、分享或简历数据库；新建隔离验收数据。旧资源可作为数据库静态档案留存。
- 首批连续纵向文档和局部网格；不宣称独立双栏分页。
- 所有模板支持同一套正文、评论、历史和导出入口。动画复用项目规范并接入减少动效。
- 数据库变更先隔离验证，再部署链接项目 `bitxrpdtlohlnywgusfw`，最后核验账本、读取与权限。

## 文件与职责

| 文件/目录 | 责任 | 执行者 |
| --- | --- | --- |
| `src/lib/resume-template/declarative/types.ts`、`schema.ts`、`validate.ts` | 节点、绑定、样式协议与语义预算校验 | 主代理 |
| `src/lib/resume-template/definition-schema.ts` | 新协议公开入口和统一错误 | 主代理 |
| `src/lib/resume-template/declarative/styles.ts`、`bindings.ts` | 受控样式解析、绑定作用域、资源约束 | 渲染任务 |
| `src/components/resume/runtime/`、`src/components/resume/fields/` | 通用节点渲染、字段投影、富文本样式 | 渲染任务 |
| `template-resources/` | 两份结构化定义、目录、素材与示例引用 | 模板任务 |
| `src/lib/resume-template/content/` | 空内容过滤和统一展示字段 | 主代理 |
| `src/lib/resume-template/binding.ts`、`share.ts` | 精确引用与新分享信封 | 主代理 |
| `src/lib/resume-template/source/`、`src/store/resume-template/` | 新目录、资源、缓存和加载 | 资源任务 |
| `src/pages/template/`、创建入口 | 静态卡片与新默认创建 | 资源任务/主代理 |
| `src/components/resume/pagination/` | 四边边距、资源门禁、稳定签名和合法断点 | 主代理 |
| `src/store/resume/helpers/doc-html.ts` | 新结构 Word 简化 | 主代理 |
| `scripts/build-template-seed.ts`、发布工具 | 严格读取资源、生成新发布 SQL，不重放旧种子 | 主代理 |
| `tests/resume-template/` | 协议、资源、数据库、浏览器和 PDF 证据 | 主代理 |

## 任务 1：固定公开协议与执行接口

- [x] 创建 `declarative/types.ts`：定义 TemplateNode、TemplateStyle、StyleValue、TemplateAsset、Binding、TemplateDefinition。
- [x] 定义文档 `document`、模块配方 `section`、五类内容配方 `contentByKind`；每份配方是节点列表，不引用 React 部件名称。
- [x] 节点覆盖 box/text/field/richText/repeat/sections/blocks/shape/meter/image；box 提供 stack/row/wrap/grid 布局，repeat 提供 source、字段顺序和分隔符。
- [x] 绑定采用枚举：profile、section、block、item 的明确字段/集合；禁止任意对象路径或求值。field 保留 ContentField，richText 成对绑定字段身份与 HTML。
- [x] 样式数值接受有限数字或 `{ token, factor?, add? }`；颜色接受固定六位颜色或颜色 token。属性严格白名单，拒绝 URL/CSS 字符串/事件与脚本。
- [x] 实现严格 schema、引用/作用域/样式检查、唯一节点 ID、定义 256 KiB、512 节点、16 层深度、资源引用有效性和支持能力校验。

公共格式约定（完整字段以本任务实际导出的类型为唯一依据）：

```ts
type TemplateContract = 'declarative-flow@1'
type ContentKind = 'experience' | 'richText' | 'skills' | 'fieldList' | 'tagList'
interface RenderScope {
  profile?: ProfileContent
  section?: ContentSection
  block?: ContentBlock
  item?: ExperienceContent | SkillContent | ContentField
}
// definition.schemaVersion = 2
// definition.renderContract = 'declarative-flow@1'
// definition.document / section / contentByKind[kind] 为通用节点数组。
// parseTemplateDefinition(input: unknown): TemplateDefinition
```

验证：`node tests/resume-template/protocol.ts`。样本必须拒绝旧 schema、未知节点/绑定、缺失样式、重复 ID、超深结构、非法 SVG 路径与资源引用；两个合法模板通过。

## 任务 2：实现通用解释器与样式环境

- [x] `styles.ts` 从简历外观和模板 token 生成确定的文字、间距、颜色；用户字号、主题、字体和行高保持作用，不依赖应用根字号。
- [x] `bindings.ts` 根据当前作用域返回字段/列表/文本/比例；个人资料可排序，技能熟练度复用领域映射。
- [x] 通用 renderer 只按节点 type 分派；sections 按可见模块遍历，blocks 按内容 kind 使用声明式配方。
- [x] repeat 在有内容集合上展开，使用条目/字段身份作为 key；过滤空值后插入分隔符，避免首尾多余分隔。
- [x] 字段组件接受解析后的文字样式，继续净化富文本并保留 nodeKey 和段落 ordinal；静态文字和装饰不建立评论身份。
- [x] 通用 SVG 仅允许受限 path；装饰局部定位，正文禁止任意绝对定位、隐藏和截断。
- [x] 实施展开预算及错误边界；字体和必要素材完成后才能测量；不同预览实例样式独立。
- [x] 删除 `template-parts/`、`template-layouts/` 和 `registry/visual-components.tsx`，删除旧 Runtime 的模板专属分支。

验证：类型检查与浏览器显示两份定义；使用第三份只改结构数据的模板，证明无 ID 分支即可渲染。

## 任务 3：用资源重建两套模板

- [x] 创建 `template-resources/default/v2.json`、`classic-ribbon/v2.json` 和新目录资源；前端运行代码不得导入它们。
- [x] 默认：居中姓名、求职信息行、下划线标题、名称/职位/右侧日期、正文、边框标签；空模块完全不输出。
- [x] 蓝金：固定中英文文案、圆底矢量图标、斜角色带、两列个人信息排序、左侧线、带折角标题、三列经历、三列技能条。
- [x] 保留两套设计特征与用户主题含义；统一四边边距，不保留旧空槽或底部零边距。
- [x] 所有文本、图形和条件由数据描述；不新增按模板 ID 判断的 renderer。
- [x] 保留现有两份虚构示例内容供创建，模板资源和示例版本独立。

验证：严格 parser 通过；节点/字段覆盖脚本通过；真实短、临界、长内容 PDF；冻结构建后的新模板验证。

## 任务 4：资源与目录加载

- [x] 新目录携带 schema/contract、默认示例与预览引用；目录只读摘要，卡片渲染图片，详细预览再加载定义。
- [x] 新 Source 只接受精确新格式，定义与素材 SHA-256 验证后缓存；新缓存命名空间使旧数据失效。
- [x] 素材用内容哈希定位，记录 MIME、尺寸、体积、必要性；仅官方发布通道写入，客户端只读。
- [x] 内存、IndexedDB 与 Zustand 资源记录有界，活动资源保持有效；同 key 请求合并、迟到响应隔离，损坏缓存删除重取。
- [x] 静态预览与模板版本、示例版本、外观和参考日期匹配；缺图显示占位，不能冒用另一示例图。
- [x] 调整远端资源测试到新版本；覆盖离线冷/暖、哈希错误、缺版本、预算、去重和重试。

验证：`node tests/resume-template/remote-source.ts`，真实页面检查列表不运行全文测量且进入预览能加载。

## 任务 5：业务入口与旧路径清理

- [x] 严格 binding 要求 official、templateId 和正整数 templateVersion；缺失或旧格式明确失败，不映射默认。
- [x] 替换旧分享信封为单一声明式信封，定义与 ID/版本相符，冻结资源清单；删除 legacy-manifest。
- [x] 更新 resume snapshot 类型与各使用点，保留内容身份和协作链路；不把用户正文覆盖回旧快照。
- [x] 快速创建从新目录确定 default 精确版本与示例，移除本地 catalog 导入和旧兼容默认常量。
- [x] 模板库、本地/云端创建、历史 PDF、分享 PDF 均接同一 Runtime；新建测试数据验证。
- [x] 删除运行期本地定义和旧 Source 索引；维护工具从独立资源目录读文件。
- [x] Word 统一从确定样式输出简化 HTML，保留文本顺序和标题配色，去除纯装饰；仍输出 `.doc`。

验证：`rg` 检查无 `legacy-manifest`、旧模板部件、旧定义导入；创建连击/失败重试、分享冻结往返与历史快照独立性断言。

## 任务 6：分页与真实输出

- [x] 测量、展示和打印正文四边均使用 pageMargin；装饰用不占纸张正文尺寸的内描边。
- [x] 文本行和原子元素形成合法边界，过滤横排其他列文字范围内的候选点；超大原子明确失败。
- [x] 签名加入正文视口尺寸及确定排版环境，更新正文/定义/外观后旧 ready 立即失效。
- [x] 打印 iframe 内等待字体和图像，重新测量后严格比较签名；统一精确保色。
- [x] 在 `tests/resume-template/` 增加浏览器样本与输出采集脚本，不将测试入口放入生产路由。

验证：两模板×短/临界/长×背景关闭/开启，从真实导出入口捕获打印副本并生成 PDF；检查页数、末尾文本、颜色与裁切。测试所有现有字体、长名称、模块隐藏和边距/字号边界。

## 任务 7：数据库与资源发布

- [x] 读取官方资源表/约束和线上 migration ledger；核对 Supabase 文档及已链接项目。
- [x] 使用 `supabase migration new declarative_resume_templates` 创建迁移，调整版本协议约束、新目录验证、素材清单及公开只读 RLS；不重放旧种子或删除业务数据。
- [x] 发布器从资源文件严格解析，生成确定文本与哈希，仅插入新模板版本并更新对应目录。
- [x] 在隔离 PostgreSQL 验证草稿不可见、发布不可变、素材依赖有效、新目录只引用新协议、精确引用读取和权限。
- [x] 完成素材与预览发布及读回检查，应用迁移到链接项目；核对新迁移账本，若修改 Edge Function 则部署并检查版本。
- [x] 执行公开 API smoke，并使用线上资源在本地生产构建验证本地创建/刷新/PDF，检查新增安全与性能 advisors；保存证据。真实登录云端业务端到端流程的限制单列在验收记录。

数据库检查使用 `tests/resume-template/database.sql`，线上检查 `node tests/resume-template/online.ts`。新资源通过前才切换目录；记录构建与目录恢复依据，不保留旧引擎。

## 任务 8：独立审查、整体验证和文档

- [x] 子代理执行任务级审查及最终覆盖协议、渲染、资源、分页、分享的独立审查；修复重要问题后重跑对应验证。
- [x] `pnpm exec tsc -p tsconfig.app.json --noEmit` 与 `pnpm exec tsc -p tsconfig.node.json --noEmit` 退出 0。
- [x] 变更文件 ESLint、`pnpm build` 与 `git diff --check` 通过；不扩大修改已有无关文件。
- [x] 记录真实验证结果到 `docs/superpowers/plans/2026-10-22-declarative-template-engine-validation.md`，分清脚本、浏览器、数据库及受限项目。
- [x] 更新维护手册为新协议、资源发布、四边分页和单一引擎；保留原文中仍适用的导出验收要求。
- [x] 所有必要任务完成后交付；不 push。不能用构建通过代替 PDF、数据库或业务链路验收。

## 计划自检

- 规格 1–5：任务 1–3；规格 6：任务 4、7；规格 7：任务 6 与 Word；规格 8–10：任务 3、5、7；规格 11–13：任务 6–8。
- 本计划优先遵循仓库约定：当前分支、无 TDD 要求、测试统一 `tests/`、云端部署由代理完成。
- 先固定任务 1 的类型与接口，再分派可独立编辑的渲染/模板/资源任务；依赖变更通过主代理协调，避免共享文件同时修改。

## 执行结果

实施与分层验证已完成。两套 `@2` 模板及目录资源已发布，云端迁移账本为 `20261022142621`。最终工程检查、12 份真实打印 PDF、字体/边界/离线回归、生产页面本地创建与冻结构建后的第三模板验证通过。

具体结果、独立审查修复、原始证据位置，以及未覆盖的真实登录云端端到端流程，见 [验收记录](./2026-10-22-declarative-template-engine-validation.md)。
