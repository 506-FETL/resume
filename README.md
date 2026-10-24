<h1 align="center">GResume</h1>

<p align="center">
  <strong>为不同岗位准备简历，把修改、分享和面试跟进放在一起。</strong>
</p>

<p align="center">
  <a href="https://506resume.cc/">在线体验</a> ·
  <a href="#简历模板选好排版再写自己的经历">简历模板</a> ·
  <a href="#岗位定制与历史版本">历史版本</a> ·
  <a href="#简历优化找到问题并逐项修正">简历优化</a> ·
  <a href="#ai-agent在工作台内完成修改">AI Agent</a> ·
  <a href="#分享与审阅明确对外版本">分享审阅</a> ·
  <a href="#实时协作直接修改同一份简历">实时协作</a> ·
  <a href="#本地运行与自托管">本地运行</a>
</p>

<p align="center">
  <a href="./docs/assets/readme/hero.svg">
    <img src="./docs/assets/readme/hero.svg" width="1000" alt="基础简历进入 GResume，再用于岗位定制、分享和求职跟进" />
  </a>
</p>

## 简历模板：选好排版，再写自己的经历

从空白页开始写简历，往往要同时决定两件事：经历怎么表达，页面怎么安排。照着参考简历填写，新增一段工作经历后又可能需要重新对齐标题、日期和间距。GResume 把排版准备放在填写之前：按风格和布局挑选模板，预览完整示例，再进入编辑器逐项换成自己的经历。

模板决定整份简历的布局与视觉，示例提供可替换的内容起点。选择同一模板时，可以分别查看应届生和前端开发示例；确认使用后，沿用当前的本地或云端模式创建简历。示例只复制一次，后续刷新、协作和分享都使用用户自己的正文。

<p align="center">
  <a href="./docs/assets/readme/template-journey.svg">
    <img src="./docs/assets/readme/template-journey.svg" width="1000" alt="从选择布局、预览示例到创建简历、逐项替换经历；新增条目复用当前模板排版" />
  </a>
</p>

如果每增加一套设计，就复制一份表单、渲染组件和导出逻辑，模板越多，修复同一个问题的成本就越高。当前实现将**正文、模板定义和示例分开保存**：正文记录字段与经历，模板用声明式 JSON 描述如何呈现，所有模板交给同一个解释器渲染。

| 模板中要表达的设计         | 配置如何描述                                          | 运行时如何复用                                           |
| -------------------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| 整页是单栏还是双栏         | `page.regions` 指定区域宽度和模块归属                 | 共用区域布局与分页计算                                   |
| 页头、章节标题与内容容器   | `document`、`section` 组合通用节点                    | 同一套节点解释器处理容器、字段和图形                     |
| 每条经历、技能与证书的排法 | `contentByKind` 定义内容类型的排版，`repeat` 遍历条目 | 教育、工作和实习共用经历类型；新增条目直接按同一规则呈现 |
| 字号、颜色、间距与装饰     | `styles`、`tokens` 和精确素材引用                     | 共用样式解析，结合用户选择的字体、主题与页边距           |

例如，时间轴中的日期位置、连接线和经历卡片都由模板配置表达，教育与工作只提供各自的数据。新增第二段工作经历时，解释器重复同一套条目结构；无需为这个模块再写一套样式，也不生成新的模板。双栏模板则把模块分配给两个区域，分别测量和分页，最终取两侧页数的最大值，不自动跨栏搬运内容。

<p align="center">
  <a href="./docs/assets/readme/template-architecture.svg">
    <img src="./docs/assets/readme/template-architecture.svg" width="1000" alt="Supabase 模板资源经缓存与校验进入通用解释器，用户正文经过内容映射保留字段身份，统一用于预览、分页和打印" />
  </a>
</p>

模板库也不应因为设计增多，就在打开页面时排版所有简历。目录从 Supabase 分页读取，每页 12 条摘要；卡片按可见范围加载静态预览图，打开详情才加载精确版本的定义、示例和必要素材。统一的数据源合并重复请求，限制最多 4 个网络请求并发，并复用内存与 IndexedDB 缓存。目录缓存 5 分钟，已验证的精确资源按版本或内容哈希复用；资源缓存有数量和容量上限。列表目前采用追加加载，尚未做虚拟网格。

远端配置进入渲染器之前，还要通过 SHA-256、Zod 结构、字段绑定与能力检查，并限制节点数量和嵌套深度。浏览器只读已发布资源；模板不能携带任意脚本、CSS 或组件路径。缺少指定版本或必要素材时明确提示重试，避免悄悄换成另一种排版。首次加载需要网络，缓存齐全后可继续使用已读取的资源。

排版改变的是呈现方式，字段身份仍沿用原有文档。内容映射保留条目 ID 和评论定位键，表单与富文本继续走现有协作通道；装饰图形不参与评论定位。分享时冻结正文、模板定义及精确素材清单，目录更新不会改变已发出的版本。预览与 PDF 使用同一解释器和分页规则，打印前等待字体、图片与布局稳定，再检查打印副本；Word 保留文本顺序和基本样式，允许简化装饰。

<p align="center">
  <a href="./docs/assets/readme/template-release.svg">
    <img src="./docs/assets/readme/template-release.svg" width="1000" alt="新设计经过校验与真实导出验收后发布不可变版本，再更新目录；新建简历采用推荐版本，已有简历保留精确绑定，分享保留冻结快照" />
  </a>
</p>

后续新增模板，主要维护的是 JSON、示例引用和预览素材。已有节点能表达的设计，发布资源即可；遇到新的布局语义，才扩展公共协议与解释器，并先发布支持该能力的前端。模板定义、示例和素材发布后不可覆盖，修改设计要创建新版本，最后再更新目录推荐。已有简历保存精确版本绑定，下架目录仍保留其引用的资源；目前没有主动升级模板的入口。

实现入口见[模板协议](./src/lib/resume-template/declarative/)、[内容映射](./src/lib/resume-template/content/)、[通用解释器](./src/components/resume/runtime/declarative-renderer.tsx)和[远端数据源](./src/lib/resume-template/source/)。发布前的校验、版本维护及协作、评论、分享与导出验收约束，集中记录在[模板维护手册](./docs/resume-template-maintenance.md)。

## 岗位定制与历史版本

同一段项目经历，投前端岗位和全栈岗位时可能需要不同的侧重点。GResume 按岗位描述（JD）从基础简历派生独立副本，保留来源和改动记录，各岗位版互不影响。修改前后可以对比，不合适时从历史版本恢复。

这里区分了两种关系：岗位版本是从哪份简历派生的，同一份简历又改过哪些内容。前者用父子关系记录，后者保存文档快照。恢复时将快照写回当前文档，并新增恢复记录，让后续修改仍有迹可查。

求职看板把岗位与简历关联，面试轮次和下一步安排放在一起，方便准备面试、跟进进度。看板关联的是持续编辑的简历；要保留投递当时的内容，需要使用[固定分享快照](#分享与审阅明确对外版本)或导出文件。

<p align="center">
  <a href="./docs/assets/readme/workflow.svg">
    <img src="./docs/assets/readme/workflow.svg" width="1000" alt="编写基础简历、岗位定制、分享与跟进" />
  </a>
</p>

<p align="center">
  <a href="./docs/assets/readme/screenshots/dashboard.jpg">
    <img src="./docs/assets/readme/screenshots/dashboard.jpg" width="1000" alt="首页的今日待办与待跟进岗位" />
  </a>
</p>

## 简历优化：找到问题并逐项修正

一条“项目描述不具体”的建议，需要指出哪段经历缺少什么信息，才方便修改。优化系统将问题定位到原文，给出依据和建议，并记录处理进度。JD 对比用于检查经历与岗位要求的差距，ATS 纯文本预览用于检查机器能读到哪些内容。

模型可能给出没有对应字段的建议。系统先根据已填写内容确定评估范围，再统一模型返回的格式，校验问题位置和修改值的类型，避免指向不存在的模块或写入不合适的数据。评分用于辅助检查，不代表招聘系统的筛选结果。

## AI Agent：在工作台内完成修改

让 AI 修改简历，通常要先提供上下文，再把结果贴回去核对。GResume 的 Agent 直接读取工作台中的简历、评估结果和求职记录，按任务调用工具。写入前展示修改差异或操作摘要，确认后可在右侧画布查看结果。经历和数字是否真实，仍需本人判断。

分析依赖当前数据，修改结果又会影响下一步判断，因此工具执行结果会回到对话中，供 Agent 继续处理；默认最多 12 步。任务需要的技能和参考资料按需读取，减少无关内容占用上下文。

<p align="center">
  <a href="./docs/assets/readme/screenshots/assistant-workspace.jpg">
    <img src="./docs/assets/readme/screenshots/assistant-workspace.jpg" width="1000" alt="AI 对话、工具操作与简历预览画布" />
  </a>
</p>

流式响应、工具执行和用户确认并不同步。分片必须组成完整参数后才能执行，简历字段写入还要经过类型校验和确认。用户停止对话时，取消信号会传到工具和确认流程，写入前再次检查，避免等待中的操作随后继续写入；已经完成的修改则保留。

模型请求由服务端代理转发，密钥不进入浏览器。为处理重试和流中断，额度按请求唯一标识预留，再按实际交付情况结算，避免重复扣减。

<p align="center">
  <a href="./docs/assets/readme/agent-control-plane.svg">
    <img src="./docs/assets/readme/agent-control-plane.svg" width="1000" alt="Agent 工具循环、简历字段写入确认和请求额度结算" />
  </a>
</p>

## 分享与审阅：明确对外版本

发出简历后，继续编辑不应悄悄改变对方看到的内容。分享时同时固定正文与模板快照，让工作副本和对外版本分开。需要更新时，明确发布新版本即可沿用原链接。链接可设置密码、有效期和评论权限，也能查看访问次数与最近访问时间。

<p align="center">
  <a href="./docs/assets/readme/product-sequence.svg">
    <img src="./docs/assets/readme/product-sequence.svg" width="1000" alt="选择简历和 JD、审阅修改、发布固定分享快照的时序" />
  </a>
</p>

审阅意见直接标在原文上，省去截图和解释位置。正文修改后，旧位置可能指向另一句话，因此评论按版本隔离，同时保存所在段落、原文及前后文；迁移到新版本时，只有唯一匹配才重新绑定，无法确定的意见保留为待重连。

断线还可能漏掉评论通知。实时通道只负责提醒，客户端按事件序号从日志补齐遗漏。评论同步与简历保存分别处理，评论出错不会把已经成功的保存判为失败。

<p align="center">
  <a href="./docs/assets/readme/comment-anchoring-recovery.svg">
    <img src="./docs/assets/readme/comment-anchoring-recovery.svg" width="1000" alt="按版本隔离评论、用上下文迁移锚点并恢复漏掉的事件" />
  </a>
</p>

## 实时协作：直接修改同一份简历

请朋友帮忙改简历时，双方直接编辑同一份文档，能看到彼此的改动和富文本光标。讨论可以指向正在修改的段落，免去反复传文件、解释位置和手工合并，减少沟通与操作成本。

表单修改的是字段和条目，富文本修改的是字符与格式，二者需要各自合适的合并方式。表单沿用 Automerge 文档，富文本采用编辑器已有的 Yjs 协作能力，分别合并增量。这个选择保留了原有文档模型，也能使用富文本协作光标，代价是维护两套同步状态。

接入同步后，还要避免打断正在输入的人：远端变化只回填受影响的字段，保留焦点和光标；更新携带来源标记，防止收到后又广播回去；新成员加入时先补齐状态。两套引擎共用实时传输服务，合并逻辑和持久化各自处理。

<p align="center">
  <a href="./docs/assets/readme/dual-crdt-collaboration.svg">
    <img src="./docs/assets/readme/dual-crdt-collaboration.svg" width="1000" alt="Automerge 与 Yjs 的独立通道、增量更新和回环阻断" />
  </a>
</p>

## 分页与导出：交付前看清结果

编辑时排好的内容，导出后应保持同样的分页。PDF 复用预览的页面结构与分页规则，按浏览器实际渲染的文本行、图片边界选择断点，减少另算一套版式带来的偏差。字体或内容改变后重新测量。

测量过早会得到错误断点，因为字体加载后，行高和换行位置仍可能变化。系统等待字体就绪，连续两帧的布局测量结果一致才采用，最多尝试 8 帧。打印前再测一次克隆后的页面，核对布局摘要；结果不一致时提示错误。

Word 从同一份结构化内容生成，但排版由目标软件处理，字体和分页仍需在 Word 中复核。

<p align="center">
  <a href="./docs/assets/readme/deterministic-a4-pagination.svg">
    <img src="./docs/assets/readme/deterministic-a4-pagination.svg" width="1000" alt="文本行测量、完整断点、布局稳定检测和打印签名复核" />
  </a>
</p>

## 本地运行与自托管

打开[在线编辑器](https://506resume.cc/)即可创建简历，无需先注册。编辑结果先保存在浏览器的 IndexedDB，输入和预览在本地完成，不必逐次等待网络响应。清理站点数据前，需要导出或确认简历已同步。

云同步、分享、协作、求职看板和 AI 在登录后使用。数据库按用户权限隔离记录，需要特权的操作放在服务端执行。AI 仅在调用时向模型服务发送所需上下文，本地编辑本身不需要模型请求。

<p align="center">
  <a href="./docs/assets/readme/architecture.svg">
    <img src="./docs/assets/readme/architecture.svg" width="1000" alt="本地编辑、浏览器存储与可选的 Supabase 云端服务" />
  </a>
</p>

本地开发需要 Node.js 24、pnpm 10.33.3 和可用的 Supabase 项目配置：

```bash
git clone https://github.com/506-FETL/resume.git
cd resume
corepack enable
pnpm install --frozen-lockfile
```

在根目录创建 `.env.local`：

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_BASE_URL=http://localhost:5173
```

运行 `pnpm dev`，打开 `http://localhost:5173`。完整云端功能还需部署数据库与函数，步骤见[自托管指南](./docs/self-hosting.md)。`VITE_` 变量会进入浏览器，不能放服务端密钥。

<p align="center">
  <a href="./docs/assets/readme/tech-badges.svg">
    <img src="./docs/assets/readme/tech-badges.svg" width="820" alt="React、TypeScript、Vite、Tailwind CSS、Tiptap、Zustand、Supabase 与 MIT" />
  </a>
</p>

## 开发与贡献

| 命令                | 用途                         |
| ------------------- | ---------------------------- |
| `pnpm dev`          | 本地开发                     |
| `pnpm lint`         | ESLint 代码质量检查          |
| `pnpm lint:fix`     | 自动修复 ESLint 问题         |
| `pnpm format`       | 补齐逻辑段落空行并格式化文件 |
| `pnpm format:check` | 检查代码规范、段落与格式     |
| `pnpm build`        | 生产构建，输出到 `dist/`     |
| `pnpm preview`      | 预览构建产物                 |

ESLint 负责 JavaScript、TypeScript 和 React 代码检查，Prettier 负责格式化，`eslint-config-prettier` 关闭冲突的格式规则。格式沿用 `.prettierrc` 中的约定，忽略范围见 `.prettierignore`。VS Code 安装工作区推荐的 ESLint 和 Prettier 扩展后，保存时会自动修复并格式化。

代码按逻辑分段：变量准备、条件判断、处理逻辑和最终返回之间留一个空行，函数和类型声明也单独分段；同一组简短变量与连续 guard 可以保持紧凑。ESLint 的 `@stylistic/padding-line-between-statements` 自动补齐段落空行，Prettier 负责缩进、折行与合并多余空行。`pnpm format` 先运行 Prettier，再只执行 ESLint 的 layout 修复；需要修复其他代码质量问题时使用 `pnpm lint:fix`。完整约定见 [AGENTS.md](./AGENTS.md)。

提交 [Issue](https://github.com/506-FETL/resume/issues) 时请附复现步骤，移除真实简历和令牌。PR 请说明改动与验证结果，界面修改附截图，数据库或协议修改说明兼容性影响。安全问题通过[维护者主页](https://github.com/506-FETL)的联系方式私下沟通。

[MIT License](./LICENSE) · [更新日志](https://506resume.cc/changelog) · [第三方许可证](./public/licenses/)
