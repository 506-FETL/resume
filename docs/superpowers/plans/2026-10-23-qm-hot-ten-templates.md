# 全民简历 10 套模板实现计划

> 维护状态（2026-10-23）：本地模板资源、一次性模板发布/验收工具及截图/PDF 已按用户要求清理。下文涉及这些路径和命令的内容是当时的实施记录；当前操作以 `docs/resume-template-maintenance.md` 为准。云端已发布资源保持不变。

> **面向 AI 代理的工作者：** 使用 subagent-driven-development 逐任务实现与审查。步骤使用复选框跟踪进度；当前分支工作，不创建 worktree，不推送远端。用户已授权持续执行，不在普通实现步骤重复请求批准。

**目标：** 新增 10 套与已选参考对应的可编辑模板，保留原有两套，发布云端目录并完成真实 PDF 验证。

**架构：** 单一 schemaVersion 3 / declarative-page@1 协议；结构、样式、矢量和区域分配是远端资源，React 只解释通用节点。单栏与双栏均使用同一个 A4 分区分页器，照片随快照存储。

**技术栈：** React 19、TypeScript、Zod、Zustand、react-image-crop、Supabase/Postgres、现有 react-to-print 导出入口及浏览器验证工具。

**规格：** ../specs/2026-10-23-qm-hot-ten-templates-design.md。

## 全局约束与完成门禁

- 选款固定为 1015、1044、1054、1057、1058、1012、1056、1005、1046、1011。排除与已有模板相近的 1004、1045。
- 新模板 ID：navy-sidebar、blue-section-bars、sky-cards、playful-stickers、nature-green、blue-angle、teal-timeline、blue-capsule、blue-portrait、slate-sidebar。
- 现有 default、classic-ribbon 发布 @3；新增十套发布 @1；定义 schema 为 3。没有旧协议运行时和旧数据兼容。
- 不按模板 ID 写专属渲染分支。新定义、布局或装饰保存在 template-resources；前端不得导入该目录。
- 测量、展示、打印几何完全相同；不降低稳定性校验要求。侧栏、主栏独立分页，无字段重复和丢失。
- 现有业务字段身份、模块排序与可见性保持；照片不进入评论文本、ATS 或 AI 文本。
- 写入和运行验证统一位于 tests/resume-template；scripts 只放模板生成、发布维护工具。
- 测试不是 TDD 强制流程；先实现清晰能力，再进行有针对性的验收。没有相关代码变更不重复跑大矩阵。
- 72 份基础 PDF（12 模板 × 短/临界/长 × 背景开关），外加双栏压力；必须实际检查 PDF 文本、分页、图片与装饰。
- 云端迁移/函数修改由代理完成部署和线上核验；没有部署证据不能记作完成。

## 文件与职责

| 文件/目录 | 职责 |
| --- | --- |
| src/lib/resume-template/declarative/{types,schema,validate,bindings,styles}.ts | 唯一协议、绑定校验、样式解析 |
| src/lib/resume-template/declarative/page.ts | 纯函数解析区域几何、模块路由 |
| src/components/resume/runtime/declarative-renderer.tsx | 通用节点解释、区域配方选择 |
| src/components/resume/runtime/{template-region-context,template-page-background,template-shapes}.tsx | 区域上下文、页面装饰、共享图形 |
| src/components/resume/pagination/{types,utils,use-pagination-plan,canonical-paged-document,use-resume-print}.ts(x) | 独立区域测量、逐页裁切、打印复核 |
| src/components/resume/pagination/scaled-resume-document.tsx、src/components/resume/scaled-readonly-preview.tsx | 向分页层传递完整定义 |
| src/pages/history/components/version-pdf-export/index.tsx | 历史导出使用同一页面计划 |
| src/lib/schema/resume/form/{basic,photo}.ts | 可选照片与严格大小/格式约束 |
| src/pages/resume/editor/components/forms/basic-resume/components/resume-photo/ | 选择、裁切、替换、删除与动效 |
| src/lib/resume-template/content/{types,adapt-profile}.ts | 照片及字段语义适配 |
| src/lib/resume-template/{share,source/resource-schema,source/types}.ts | 新协议分享与远端资源格式 |
| template-resources/*/v*.json、catalog.json、previews/ | 12 套资源及 24 份精确预览 |
| scripts/build-qm-templates.ts、scripts/build-template-seed.ts | 维护端配方生成及发布 SQL |
| supabase/migrations/、supabase/functions/resume-share/ | 云端协议约束与分享校验审计（函数无需修改） |
| tests/resume-template/{page-protocol,photo,hot-templates}.ts | 协议、照片、目录行为验证 |
| tests/resume-template/{harness.tsx,browser.mjs,previews.mjs,inspect-pdfs.py} | 浏览器/真实打印矩阵与证据 |

## 接口约定

保持既有 document、section、contentByKind 配方，增加必需的 page 描述；区域可覆写这些配方。单栏也走相同区域接口。以下是实现契约，落地时以 types.ts 导出类型为准，不另建第二套协议。

```ts
interface TemplatePage {
  fullBleed: boolean
  gap: number
  background?: ColorValue
  decorationFirstPageOnly?: boolean
  decoration?: TemplateShape[]
  pattern?: { kind: 'dots'; color: ColorValue; spacing: number; radius: number; opacity: number }
  regions: TemplateRegion[] // 1–2 个，width 为相对权重
}
interface TemplateRegion {
  id: string
  width: number
  sections: string[] | 'remaining'
  padding?: [StyleValue, StyleValue, StyleValue, StyleValue]
  background?: ColorValue
  document?: TemplateNode[]
  section?: TemplateNode[]
  contentByKind?: Partial<Record<ContentKind, TemplateNode[]>>
}
// 每个区域包含完整连续内容流；Context 选择需要输出的流。
const TemplateRegionContext = createContext<string | null>(null)
```

`fullBleed=false` 时沿用四边用户页边距；true 时纸张区域抵达页边，页头/正文内部通过新增 pageMargin 数值 token 控制缩进。区域 padding 参与可用几何，区域底色在 padding 外绘制。区域宽度之和、间距和边距由纯函数解析，返回固定的 left/top/width/height，不依赖屏幕缩放。

增加 photo 节点、section.key/index、item.index/first/last/fieldKey 等受控绑定；text 支持包内 map 和 pad2 序号格式；shape 支持绑定驱动的包内图形变体；repeat 支持 fieldKeys 精确筛选。样式增加四角圆角、字距、透明度、虚线、受限阴影、旋转；图形增加透明度。所有映射和引用严格验证。

## 任务 1：冻结计划与基线

- [x] 读取现有协议、渲染器、分页器、打印入口、发布器及 10 张参考图。
- [x] 记录用户批准、原有两套保留、相近款替换结果及唯一协议目标。
- [x] 写出本计划与接口约定。
- [x] 将原有两套的当前截图/输出留作对照，记录 git 基线与资源版本。
- [x] 读取当前链接项目与迁移账本，核实部署能力；凭据不写入日志或文档。

## 任务 2：协议与通用渲染能力

- [x] 更新上述 declarative 类型、Zod schema 与语义校验，新增 page/region；重复区域、重叠模块、多个 remaining、未知模块键必须报错。
- [x] 将 profile/section 的投影按区域消费；每个可见模块只能出现在一个区域，未显式分配的模块落入 remaining。
- [x] 扩展样式解析；负尺寸、越界透明度、任意 CSS/URL 均被拒绝；装饰单独绘制，不改变正文盒模型。
- [x] 拆出 ShapeView 与页面背景，渲染受控图形、点阵、透明圆环和必要打印底色。
- [x] 添加上下文驱动的区域配方选择与直接渲染时的完整区域输出，字段主投影继续校验。
- [x] 添加 photo 节点与编号/映射绑定；照片未提供时返回空节点，父容器能收缩。
- [x] 使用 `node tests/resume-template/page-protocol.ts` 检查路由、样式约束、图形变体、旧协议拒绝和节点预算，预期全部通过。
- [x] 任务审查记录到 tests/resume-template/artifacts/reviews/，修复重要问题后进入集成。

## 任务 3：独立区域分页与正式打印

- [x] 扩展 PaginationSnapshot，使每页含按 regionId 索引的 start/end；签名包含各区域实际宽高、内容高度、几何及断点。
- [x] 使用现有 collectPageBoundaries 对每个区域分别测量，页数取最大值；空区域有确定的零内容状态，不能当作失败。
- [x] 标记章节标题 keep-with-next，与后续首个正文行一起参与禁止断点范围；不要将整张长卡片当原子。
- [x] CanonicalPagedDocument 用相同区域几何分别生成测量源与展示页；每个可见区域只裁切自己的内容流；背景逐页画在内容后方。
- [x] useResumePrint 从打印副本重测所有区域并与测量签名比较，核实每一页的 clip 参数；错误时阻止打印。
- [x] 所有 Canonical/Scaled 调用点传入 definition，包括历史与分享。sourceRef 继续提供完整正文供 Word 转换。
- [x] 运行单栏/双栏短文、主栏长、侧栏长、双栏长的聚焦验证；在测试报告记录页数、区域偏移和全文唯一标记。

## 任务 4：照片编辑与数据链路

- [x] 定义 `photo: { dataUrl: string; width: number; height: number } | null`，默认 null；只接受 JPEG 数据、最长边 640 px、解码字节不超过 96 KiB。
- [x] 编写输入解码与重新编码工具，限制原文件大小、像素数；JPG/PNG/WebP 经裁切转为 JPEG，失败时不写入表单。
- [x] 基础信息表单增加照片预览、选择/替换/删除和 3:4 裁切；状态与既有表单/store 保存链路一致。
- [x] 接入基础信息到内容适配；照片数据与姓名字段分开，不产生评论主投影。
- [x] 检查简历文本/AI/ATS 提取器，明确剔除照片数据；历史、协作及可见模块的分享快照保留照片。
- [x] 运行 `node tests/resume-template/photo.ts`，检查非法 MIME、超过大小、格式不匹配、空照片、快照回读。
- [x] 浏览器验证替换、移除、刷新、受控历史与分享快照导出；裁切弹窗两轮开关及退出中重开，包含减少动效状态。

## 任务 5：12 套资源与示例

- [x] 用维护端生成器把现有 default/classic-ribbon 转为 @3 新协议，保持视觉参数；不加载旧协议运行时。
- [x] 制作 navy-sidebar、slate-sidebar：分别路由侧栏技能/爱好/证书与主栏经历，设置独立配方和通高背景。
- [x] 制作 blue-section-bars、blue-angle、blue-capsule、blue-portrait：分别复刻横条、斜角、胶囊和居中圆像，不共享成同一页头换色。
- [x] 制作 sky-cards、teal-timeline：照片卡片、浅灰内容卡片、日期独立列、墨绿同心圆和标题细节。
- [x] 制作 playful-stickers、nature-green：重建几何贴纸/点阵/编号和自然曲线/叶片/太阳/卡片，正文仍为真实字段。
- [x] 发布新的示例版本，为演示照片使用本项目生成的中性示例图；避免复制原站个人资料或品牌为固定内容。
- [x] 每套制作参考内容夹具，绘制参考对应的页头/标题锚点；准备视觉对照报告中的实际坐标。
- [x] 对每套运行协议及渲染验证，确保全部字段可编辑，隐藏模块/改名/排序不破坏布局。

## 任务 6：资源协议、云端约束与分享

- [x] 更新目录、缓存命名空间、分享信封、资源校验至新协议；没有静默默认回退。
- [x] 经 Supabase CLI `--help` 确认命令，以 migration new 建立迁移；在隔离环境验证模板/目录 schema 约束与发布事务。
- [x] 审计 resume-share：没有显式旧协议校验，无需修改函数源码；保留既有所有权、分享权限与净化规则。
- [x] 运行协议、remote-source、business、database 聚焦脚本；核实新定义、照片快照及冻结资源完整性。
- [x] 修正维护发布器，使目录 12 套、每套两示例与精确预览哈希全部通过才允许生成正式发布 SQL。

## 任务 7：视觉调校与目录预览

- [x] 启动本地 Vite，harness 按 catalog 读取精确版本，提供模板/模式/示例选择及正式打印按钮。
- [x] 逐套读取原站公开预览和可访问 DOM 参数，截图本地实现；统一 A4 宽度后对齐页头、照片、色块、标题线与列宽。
- [x] 记录静态关键锚点误差，目标不超过 3 px；将字体与正文长度导致的差异单独列出，不能借此忽略缺失装饰。
- [x] 生成 12 × 2 的 24 张真实引擎预览 PNG，写入 catalog 的 hash/byteLength/width/height。
- [x] 验证目录卡片、创建简历、模板切换与预览使用对应新版本；无照片和不同外观时无溢出。

## 任务 8：PDF 矩阵与全文完整性

- [x] 通过正式 useResumePrint 入口捕获打印副本，输出背景开关两组 PDF；保留签名失败时阻止导出的行为。
- [x] 执行 12 模板短/临界/长内容矩阵，共 72 份基础 PDF。临界内容按实际首个区域可用高度求取，不硬编码行数。
- [x] 双栏增加各栏独立长内容/空栏组合；照片解码、长姓名/邮箱和各支持字体至少覆盖代表款。
- [x] inspect-pdfs.py 检查各页文本提取、末尾唯一标记、正文未重复/缺失、页数及图片存在；渲染 PDF 页面人工检查色块与跨页装饰。
- [x] 对比背景图形开关输出，确认关键色彩保持、尺寸和分页一致。核实默认模板回归。
- [x] 浏览器覆盖编辑、受控历史和分享 PDF 入口；最终报告区分本地隔离验证与云端登录态验证，不夸大覆盖范围。

## 任务 9：云端发布及线上复核

- [x] 类型检查 `pnpm exec tsc --noEmit`、相关 lint、`pnpm build` 和聚焦脚本通过后生成发布 SQL。
- [x] 核对当前链接的 Supabase 项目，按顺序部署迁移、受影响 Edge Functions 与不可变资源，最后切换目录。
- [x] 查询迁移账本和函数版本；检查云端 12 个活动条目、定义协议、示例、24 张预览与哈希。
- [x] 运行 `node tests/resume-template/online.ts`，对云端返回资源逐一解析；断网/资源缺失不能悄悄换成其他模板。
- [x] 使用真实应用入口读取已发布资源并完成代表性 PDF smoke；记录线上项目、版本和时间，不记录凭据。

## 任务 10：审查与交付

- [x] 生成本次完整 diff 审查包，对协议边界、独立分页、照片数据与云端发布进行规格/代码质量审查。
- [x] 修复关键和重要发现，重跑受影响的聚焦验证；只有改到分页/打印时重跑相关 PDF 矩阵。
- [x] 更新 template-resources/README.md 与 docs/resume-template-maintenance.md，补充新协议、照片限制和双栏验收。
- [x] 将完成事实、预览、PDF 报告与已知视觉差异链接给用户。未通过的门禁保持未完成，不以构建通过替代。

## 执行记录

- 用户批准规格并明确授权完整实施；原始参考十套哈希已核对。基线为 `46e9cc4`，旧两套对照位于 `tests/resume-template/artifacts/baseline`。
- 公共协议完成：35 组拒绝及行为检查；12 套配置、2 个新示例、74 次 SSR 与 24 张精确预览全部通过。
- 视觉关键锚点最大误差 2.92px。照片完整 UI、原子同步、AI 文本隔离、裁切弹窗及减少动效验证通过。
- 基础与双栏矩阵共 88 份 PDF、194 页通过；另有受控分享/历史真实按钮导出的 8 份 PDF。实际打印缺失与续页装饰遮挡问题已修复，并通过独立增量审查。
- 迁移与分批图片发布在隔离 PostgreSQL 17 通过；线上二十四份不可变图片上传、最终目录/迁移原子提交、账本原文核对及公开 API smoke 全部完成。
- 生产构建读取真实云资源的三模板创建/刷新/PDF smoke 通过；受控分享/历史两模板导出通过。最终验收共 102 份 PDF、214 页，全部检查背景开关一致与文字范围。
- 冻结生产 JS 哈希后，测试传输层新增模板仍可预览、创建、渲染，纯资源发布验证通过。未使用真实登录态操作云端简历；范围和视觉差异见独立验收记录。
