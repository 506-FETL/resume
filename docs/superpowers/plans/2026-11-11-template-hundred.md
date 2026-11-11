# 百套简历模板实现计划

> **面向 AI 代理的工作者：** 使用 subagent-driven-development 实现并审查。遵循仓库已授权自主实施规则，不创建分支、不 commit/push、不执行 TDD。

**目标：** 发布 37 套有结构区别的新模板，云端目录达到 100 套。

**架构：** 临时维护输入生成 schema3 定义，现有渲染与打印组件完成预览和导出校验，受控 CLI 上传素材并原子发布目录。前端无模板专属逻辑。

**技术栈：** TypeScript、现有 Vite/React 模板引擎、Supabase CLI、SVG 受控形状。

---

### 任务 1：构建声明式资源

文件：tests/template-hundred/build-resources.ts、tests/template-hundred/fixtures/designs.json、tests/template-hundred/generated/。

- [x] 读取现有云端定义/示例快照及设计清单，抽取复用字段、技能与富文本配方，新增 37 个独立页头／章节／经历／区域组合。
- [x] 输出每条 `{ definition, metadata: { templateId, name, description, category, currentVersion, defaultExample, examples }, sortOrder }` 到 generated/templates.json；定义严格解析、不可省略字段，只用已支持节点/样式。
- [x] 结构去掉 ID、颜色后与基线比较，实际检查几何与布局。照片不因某款紧凑设计静默丢失；所有新定义 assets 为空，装饰为原创受控形状。

### 任务 2：真实渲染及导出验收

文件：tests/template-hundred/ 的独立 Vite 夹具和验收数据，产物放其 artifacts/。

- [x] 组合 CanonicalPagedDocument、ResumeTemplateRuntime 与 useResumePrint，导出以真实打印副本为准；不改生产门禁。
- [x] 渲染 74 个精确示例并输出 794×1123 首页预览；核对新款与基线联系表。
- [x] 每模板执行短／临界／长、两个背景设置；11 双栏加五种分区边界。检查唯一经历标题和正文完整、页面非空、颜色和字符边界。
- [x] 覆盖资料字段、重排隐藏、空模块、富文本、照片、长字段；为失败项修定义并重跑受影响场景，不放宽引擎规则。

### 任务 3：维护发布与公开验证

文件：scripts/publish-template-release.mjs（受控维护工具）、临时 release.json 与 SQL。

- [x] 验证 definitions 与 preview 清单的 SHA-256、真实图像头/尺寸、2个精确示例、37个新ID和连续排序。
- [x] 通过已登录 CLI 分批写不可变图片并上传哈希 CDN 对象，检查匿名回读；现有对象必须相同，不覆盖。
- [x] 最终事务插入模板版本与目录，缺少任意素材或版本冲突全部回滚；只插新ID，不更新旧版本。
- [x] 公开 API 核对 100目录、74新图、199预览总数、37定义哈希及原63版本不变，保留RLS与CDN约束。

### 任务 4：应用验收与清理

文件：docs/superpowers/specs/2026-11-11-template-hundred-acceptance.md、docs/resume-template-maintenance.md、docs/product-development-guardrails.md。

- [x] 真实应用验证新目录首批仍12项，加载更多、筛选、详情、填名称与描述创建、返回重开、PDF。
- [x] 类型/构建/格式/差异检查通过，记录实际检查范围与前端发布状态。
- [x] 更新维护入口及本期发布证据，清理全部 tests/template-hundred 临时内容。源码资源保留云端，不重新建前端本地模板库。
