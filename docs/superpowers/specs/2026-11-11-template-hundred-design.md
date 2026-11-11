# 百套简历模板扩充设计

日期：2026-11-11。用户授权从现有 63 套扩充至 100 套，参考全民简历热门风格。采用纯资源发布，不改变现有编辑、分页与创建流程。完成实现验证后交用户审查。

## 设计依据与范围

已实际浏览[全民简历在线模板](https://www.qmjianli.com/cv/jianlimoban/)与[Word 模板列表](https://www.qmjianli.com/resume/list/word)并查看公开预览。前列不少版式已被现有模板覆盖，故新增 37 套参考热门类型的原创结构组合，不照搬成品，不把换色或不同示例算新模板。下表热度是 2026-11-11 来源页面的观测值，访问期间会变动，不是新设计排名、下载量或使用人数。

云端基线 bitxrpdtlohlnywgusfw：63 条 listed 目录，sort_order -1..61；61 份当前版本 1、2 份版本 3；62 套各含 graduate@2/frontend@2 两张预览，asu 一张，总计 125 张。本期 37 个版本 1、74 张新预览，发布后 100 条目录、199 张预览。既有版本与示例保持不变。

## 新增版式

| #   | 名称／ID                         | 布局 | 结构差异                                                 | 类型参考与页面热度                                              |
| --- | -------------------------------- | ---- | -------------------------------------------------------- | --------------------------------------------------------------- |
| 1   | 章序编辑 `editorial-number`      | 单栏 | 左姓名右照片，章节大号序号窄格、右侧标题正文，日期右置   | [来源](https://www.qmjianli.com/resume/details/word/1124)／3966 |
| 2   | 居中名片 `centered-contact-card` | 单栏 | 居中圆像姓名、三列细框资料、短下划线章节、组织职位上下排 | [来源](https://www.qmjianli.com/resume/details/word/1132)／3592 |
| 3   | 错层信头 `offset-letterhead`     | 单栏 | 左照片右姓名、错层意向联系格、开口角框章节、左日期       | [来源](https://www.qmjianli.com/resume/details/word/1141)／3982 |
| 4   | 横线档案 `ruled-profile`         | 单栏 | 双线标签资料区、左短粗线右序号章节、整行经历分隔         | [来源](https://www.qmjianli.com/resume/details/word/1101)／2217 |
| 5   | 页角括线 `corner-bracket`        | 单栏 | 开放页角、三段页头、缺口章节框、日期在标题下             | [来源](https://www.qmjianli.com/resume/details/word/1068)／2243 |
| 6   | 职位横题 `role-masthead`         | 单栏 | 职位先行姓名次行左照片、编号细线章节、职位独立次行       | [来源](https://www.qmjianli.com/resume/details/word/1122)／3604 |
| 7   | 双层联系 `divided-contact`       | 单栏 | 姓名年限在上、照片资料联系三块在下、短竖线夹标题         | [来源](https://www.qmjianli.com/resume/details/word/1146)／3782 |
| 8   | 窄题笔记 `narrow-title-notes`    | 单栏 | 姓名顶线右联系列、窄章节标题栏右正文、浅底日期签         | [来源](https://www.qmjianli.com/resume/details/word/1127)／2673 |
| 9   | 黑线简报 `black-rule-brief`      | 单栏 | 姓名意向左右、黑方块双线章节、短竖线经历头、紧凑页头     | [来源](https://www.qmjianli.com/cv/details/1045)／36640         |
| 10  | 方框身份 `framed-identity`       | 单栏 | 左细框身份右照片、编号细框章节、日期组织职位三列         | [来源](https://www.qmjianli.com/resume/details/word/1131)／3627 |
| 11  | 日期票签 `date-ticket`           | 单栏 | 左虚线日期票右经历、圆像横头、细长章节色签               | [来源](https://www.qmjianli.com/resume/details/word/1134)／3702 |
| 12  | 错层履历 `staggered-record`      | 单栏 | 奇偶经历左右错开、日期卡顶、独立联系条、椭圆章节编号     | [来源](https://www.qmjianli.com/resume/details/word/1010)／3568 |
| 13  | 间行履历 `zebra-ledger`          | 单栏 | 经历交替浅底、职位独立次行、短竖块章节、双列照片资料     | [来源](https://www.qmjianli.com/resume/details/word/1139)／3669 |
| 14  | 括线经历 `bracketed-history`     | 单栏 | 经历左上右下开口角框、左日期右正文、序号直排章节         | [来源](https://www.qmjianli.com/resume/details/word/1120)／2928 |
| 15  | 条目序签 `numbered-entry`        | 单栏 | 条目前序号日期在下、右对齐短线章节、三段页头             | [来源](https://www.qmjianli.com/resume/details/word/1019)／3685 |
| 16  | 日期层板 `date-shelf`            | 单栏 | 短上沿日期、组织职位双列、描述内缩、双规则章节           | [来源](https://www.qmjianli.com/resume/details/word/1087)／2661 |
| 17  | 双格年表 `split-meta-timeline`   | 单栏 | 左日期职位双格、右组织描述、浅色章节条、平行联系行       | [来源](https://www.qmjianli.com/resume/details/word/1098)／2571 |
| 18  | 细框履历卡 `ruled-entry-cards`   | 单栏 | 细框经历日期小签、标题下线、左像姓名右资料               | [来源](https://www.qmjianli.com/resume/details/word/1135)／3148 |
| 19  | 刻度履历 `ruler-record`          | 单栏 | 条目前刻度编号、右日期、章节左竖线底点、大姓名意向       | [来源](https://www.qmjianli.com/resume/details/word/1147)／3491 |
| 20  | 墨色右栏 `right-ink-column`      | 双栏 | 左70正文右30深色资料圆像技能、主栏大姓名、编号细框章节   | [来源](https://www.qmjianli.com/resume/details/word/1118)／3645 |
| 21  | 内嵌资料 `inset-profile-panel`   | 双栏 | 左28内缩浅卡右72正文、照片姓名卡内、角括线章节           | [来源](https://www.qmjianli.com/resume/details/word/1083)／2564 |
| 22  | 窄栏联系 `narrow-contact-rail`   | 双栏 | 左22联系技能标签、主栏照片姓名、粗下线章节编号经历       | [来源](https://www.qmjianli.com/resume/details/word/1114)／3447 |
| 23  | 右栏素线 `right-outline-column`  | 双栏 | 右32描边资料矩形像、左68正文、小块长线章节               | [来源](https://www.qmjianli.com/resume/details/word/1115)／2438 |
| 24  | 对开履历 `balanced-columns`      | 双栏 | 左45基础教育技能右55经历、姓名左照片右、矩形序签章节     | [来源](https://www.qmjianli.com/resume/details/word/1090)／3016 |
| 25  | 抽页索引 `sidebar-index`         | 双栏 | 左26浅底姓名照片资料、数字圆点两层章节、短日期条         | [来源](https://www.qmjianli.com/resume/details/word/1123)／2901 |
| 26  | 缺口双栏 `top-notch-columns`     | 双栏 | 首页V折线、左30照片资料右70姓名经历、无图标双线章节      | [来源](https://www.qmjianli.com/resume/details/word/1086)／2407 |
| 27  | 右像资料 `portrait-right-panel`  | 双栏 | 右36浅色大像资料卡左64正文、大序号章节开放角框经历       | [来源](https://www.qmjianli.com/resume/details/word/1031)／3069 |
| 28  | 双轨分栏 `twin-rule-columns`     | 双栏 | 左34右66白底、双细竖线沟槽、编号章节日期方签             | [来源](https://www.qmjianli.com/resume/details/word/1103)／2542 |
| 29  | 素色侧记 `no-photo-sidebar`      | 双栏 | 左26浅底联系技能、主栏大姓名意向、细横签章节             | [来源](https://www.qmjianli.com/resume/details/word/1094)／2295 |
| 30  | 蓝线登记 `blue-register`         | 单栏 | 四列资料格独立照片、空框章节、三列经历头自由正文         | [来源](https://www.qmjianli.com/resume/details/word/1062)／3756 |
| 31  | 开放矩阵 `open-matrix`           | 单栏 | 资料仅行分隔、居中姓名、章节左12%编号格右标题正文        | [来源](https://www.qmjianli.com/resume/details/word/1071)／3711 |
| 32  | 双签表格 `double-label-form`     | 单栏 | 双列资料网格、浅底章节条、经历标签三格正文跨全宽         | [来源](https://www.qmjianli.com/resume/details/word/1061)／3633 |
| 33  | 分区档案 `ruled-panel-grid`      | 单栏 | 左资料右照片、基础与意向独立框、上下盒章节与虚线条目     | [来源](https://www.qmjianli.com/resume/details/word/1068)／2243 |
| 34  | 折角档案 `corner-tab-dossier`    | 单栏 | 首页边缘折片、侧对姓名照片、角签编号章节与浅底经历       | [来源](https://www.qmjianli.com/resume/details/word/1007)／3024 |
| 35  | 几何信笺 `geometric-letterhead`  | 单栏 | 页头小圆短线、中央姓名右照片、细框章节错位元信息         | [来源](https://www.qmjianli.com/resume/details/word/1148)／3310 |
| 36  | 深夜双栏 `midnight-two-column`   | 双栏 | 深墨页边沟槽、白色双栏正文、照片左姓名右、轮廓章节       | [来源](https://www.qmjianli.com/resume/details/word/1088)／2239 |
| 37  | 星点页眉 `constellation-header`  | 单栏 | 首页星点连线、居中圆像姓名联系、白底正文端点细线章节     | [来源](https://www.qmjianli.com/resume/details/word/1041)／2475 |

所有版式都保留字段、用户模块顺序与隐藏状态。紧凑、无像倾向的构图仍能容纳实际用户照片；不为了画面简洁静默删除已有资料。深夜双栏使用深墨外框与白色正文区域，防止富文本内联颜色及 Word 导出不可读。首屏装饰用 decorationFirstPageOnly，避让高度来自 document 正常流，不给续页固定顶部留白。

## 技术边界

复用 schemaVersion 3 / declarative-page@1，现有 box/repeat/shape/photo 和 item-parity。模板定义仅存云端，临时生成器与资源输入位于 tests/template-hundred，结束清理。生产前端不增加本地模板注册表，不按模板 ID 新建 React 组件。不增加 schema、Edge Functions 或依赖。

每个新模板复用 graduate@2、frontend@2，真实解释器生成完整首页预览 794 × 1123，按 SHA-256 寻址并记录实际尺寸、MIME 和字节数。定义使用严格 parser 校验，字段主投影唯一，长字段可以换行。未隐藏空模块仍保留标题与装饰，遵循当前防回归规则。

## 发布与正确性

先在隔离本地夹具通过真实解释器与 useResumePrint 校验，随后受控上传不可变素材与 CDN 副本，最终一个事务插入 37 个新定义与 37 条 listed 目录，sort_order 62..98。维护调用使用已登录 Supabase CLI，不输出或落盘密钥。数据库触发器继续核验哈希、引用和 CDN；不关闭约束、不修改客户端写权限。数据发布无需数据库迁移。

发布后公开读取全部新资源核对哈希与 100 条目录，检查旧 63 套精确内容未变。真实页面检查分页、分类、详情、填写名称后创建与重开；不绕过已有确认步骤。资源发布与前端部署分别记录。

## 验收

37 套每套短、临界页底、多页长内容，关闭／开启背景打印；正式 useResumePrint 验证克隆签名后检查最终 PDF 的文本次数、页数、字符边界与保色。11 套双栏加主栏长、侧栏长、两栏同时长、空主栏、空侧栏。批量输出可以合并为带模板和场景索引的 PDF，但每项必须独立经过真实导出门禁并可追溯页码。默认模板作为对照。

静态与页面检查覆盖两个示例、照片有无、长姓名邮箱、字段补齐、模块顺序与隐藏、空模块、富文本和外观边界。按结构归一化与同示例联系表检查 37 套之间及对既有 63 套无换色重复。代码检查使用类型、构建、相关 lint、全局 format:check 与 diff --check。全部临时脚本和测试数据完成后删除，非敏感证据及云端资源哈希记入验收文档。

实施完成、验证通过、用户审查分别记录，不能把协议或构建通过写成视觉和 PDF 均通过。
