# 官方声明式模板资源

这里保存发布维护输入；前端运行代码不得导入本目录。应用从官方远程 Source 按精确版本读取并验证资源。

- `default/v2.json`、`classic-ribbon/v2.json`：首批 schema2、`declarative-flow@1` 模板。结构使用 document、section、contentByKind 配方及通用节点，样式使用包内字典和受控 token，不引用模板专属组件。
- `examples/graduate/v1.json`、`examples/frontend/v1.json`：独立版本的虚构正文。创建时复制一次并重新生成条目 ID，模板升级不覆盖示例或用户正文。
- `catalog.json`：目录摘要、精确模板/示例引用和 previews 清单。每份预览固定模板版本、示例版本、完整外观、参考日期、内容哈希、MIME、尺寸和字节数。
- `previews/*.png`：通过真实引擎生成的两模板 × 两示例首页 PNG；卡片按需读取静态图，详情使用真实渲染与分页。缺图显示占位，不能借用另一示例图片。
- `assets/`：按需新增模板图片；当前两套模板的色带、图标、折角和技能轨道主要使用声明式矢量/数值节点，无需模板专属图片组件。

在仓库根目录生成发布 SQL：

```sh
node scripts/build-template-seed.ts /tmp/declarative-resume-templates.sql
```

发布器严格验证定义、目录、示例与真实图片，要求正式目录每个候选示例都有精确预览。图片支持 PNG/WebP/JPEG，每份不超过 512 KiB，宽高不超过 4096。`--allow-missing-previews` 仅供隔离验证。SQL 只插入缺失的不可变资源，已有同版本必须内容一致，最后更新目录；脚本本身不连接数据库。

当前首批图片发布在 `official_resume_assets`：按 SHA-256 存储小图的 base64 字节和受控元数据，公开角色只读已发布行，无需 Storage 上传端点。未来 Source 可改为从 Storage/CDN 获取相同哈希资源，定义与预览协议无需改为 URL。

生成 SQL 必须经审查后由具备权限的受控项目维护通道执行。schema 迁移先通过隔离数据库验证，再部署链接项目；发布后核验账本及 `node tests/resume-template/online.ts`。已发布定义、示例和图片不可覆盖，设计改变应新增版本，并重新生成匹配的预览清单。

当前云端迁移为 `20261022142621_declarative_resume_templates`；两套 `@2` 模板、两份独立 `@1` 示例引用与 4 份 PNG 已发布，公开 API smoke 已通过。完整架构、缓存、发布步骤、真实 PDF 回归与验证范围见 [维护手册](../docs/resume-template-maintenance.md)。公开 API 和本地浏览器证据不代表已完成登录后的云端业务端到端验收。
