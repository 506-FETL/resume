# 新增五十套模板验收记录

日期：2026-10-23。目标：保留原有十二套，新增五十套独立可编辑模板并发布云端。

## 来源与实现

排除原有来源、英文翻译、仅换色与明显同版式款。热度为选型时页面显示值，不代表永久排名。五十个来源、模板 ID 与参考图片哈希均互不重复。

新增资源使用 schemaVersion 3 / declarative-page@1，每套版本 1，两个项目示例 graduate@2、frontend@2，默认展示 frontend@2。所有正文是可编辑字段；装饰使用矢量重绘，没有用整页图片替代正文。云端资源包括五十份定义和一百张 794 × 1123 预览，未增加五十个专属前端组件。

公共协议仅增加 item-parity：重复项按过滤后的可见顺序选择 odd/even 分支，供左右交错卡片使用。缺少能力声明、错误作用域和非法条件值均拒绝解析，未修改打印签名、分页容差或公共样式。

## 来源清单

| 序号 | 名称         | 模板 ID                   | 分类        | 来源                                                           | 选型热度 |
| ---- | ------------ | ------------------------- | ----------- | -------------------------------------------------------------- | -------- |
| 1    | 靛蓝报头     | indigo-masthead           | 简约 · 单栏 | [online-1019](https://www.qmjianli.com/cv/details/1019)        | 26620    |
| 2    | 青柠箭栏     | lime-arrow-sidebar        | 创意 · 双栏 | [online-1008](https://www.qmjianli.com/cv/details/1008)        | 26280    |
| 3    | 折带侧栏     | ribbon-sidebar            | 创意 · 双栏 | [online-1041](https://www.qmjianli.com/cv/details/1041)        | 26215    |
| 4    | 海军蓝铭牌   | navy-nameplate            | 简约 · 单栏 | [online-1023](https://www.qmjianli.com/cv/details/1023)        | 26191    |
| 5    | 彩块履历轴   | color-block-timeline      | 创意 · 双栏 | [online-1034](https://www.qmjianli.com/cv/details/1034)        | 26152    |
| 6    | 圆标细线     | circle-rule               | 简约 · 单栏 | [online-1016](https://www.qmjianli.com/cv/details/1016)        | 26094    |
| 7    | 方点日期轴   | square-date-rail          | 简约 · 单栏 | [online-1020](https://www.qmjianli.com/cv/details/1020)        | 25991    |
| 8    | 杏橙线描     | apricot-outline           | 简约 · 单栏 | [online-1033](https://www.qmjianli.com/cv/details/1033)        | 25923    |
| 9    | 墨蓝面板     | ink-panel                 | 简约 · 单栏 | [online-1055](https://www.qmjianli.com/cv/details/1055)        | 25881    |
| 10   | 蓝幕胶囊     | blue-pill-banner          | 简约 · 单栏 | [online-1050](https://www.qmjianli.com/cv/details/1050)        | 25731    |
| 11   | 珊瑚斜幕     | coral-slant               | 创意 · 单栏 | [online-1002](https://www.qmjianli.com/cv/details/1002)        | 25701    |
| 12   | 黑曜斜签     | black-wedge               | 简约 · 单栏 | [online-1039](https://www.qmjianli.com/cv/details/1039)        | 25591    |
| 13   | 石墨折线侧栏 | slate-step-sidebar        | 创意 · 双栏 | [online-1042](https://www.qmjianli.com/cv/details/1042)        | 25343    |
| 14   | 页边索引     | margin-labels             | 简约 · 单栏 | [online-1053](https://www.qmjianli.com/cv/details/1053)        | 25171    |
| 15   | 蓝旗页签     | resume-pennant            | 创意 · 单栏 | [online-1014](https://www.qmjianli.com/cv/details/1014)        | 25067    |
| 16   | 六边形章牌   | hexagon-heading           | 创意 · 单栏 | [online-1003](https://www.qmjianli.com/cv/details/1003)        | 24981    |
| 17   | 深蓝履历账   | navy-ledger               | 简约 · 单栏 | [online-1037](https://www.qmjianli.com/cv/details/1037)        | 24971    |
| 18   | 蓝线居中章   | centered-blue-rules       | 简约 · 单栏 | [online-1048](https://www.qmjianli.com/cv/details/1048)        | 24958    |
| 19   | 素框侧栏     | outlined-portrait-sidebar | 简约 · 双栏 | [online-1025](https://www.qmjianli.com/cv/details/1025)        | 24930    |
| 20   | 双环时间轴   | double-ring-timeline      | 创意 · 单栏 | [online-1021](https://www.qmjianli.com/cv/details/1021)        | 24890    |
| 21   | 森绿照片方块 | sage-photo-block          | 简约 · 单栏 | [online-1051](https://www.qmjianli.com/cv/details/1051)        | 25558    |
| 22   | 蓝色标题带   | blue-title-band           | 简约 · 单栏 | [online-1007](https://www.qmjianli.com/cv/details/1007)        | 24792    |
| 23   | 石板框签     | slate-frame-tabs          | 创意 · 单栏 | [online-1017](https://www.qmjianli.com/cv/details/1017)        | 22241    |
| 24   | 雾绿波页     | sage-wave-rail            | 创意 · 单栏 | [word-1104](https://www.qmjianli.com/resume/details/word/1104) | 3513     |
| 25   | 青线图标     | teal-line-icons           | 简约 · 双栏 | [word-1111](https://www.qmjianli.com/resume/details/word/1111) | 3401     |
| 26   | 灰阶双语     | gray-bilingual-sidebar    | 简约 · 双栏 | [word-1126](https://www.qmjianli.com/resume/details/word/1126) | 3376     |
| 27   | 双色蓝抬头   | split-blue-masthead       | 简约 · 单栏 | [word-1142](https://www.qmjianli.com/resume/details/word/1142) | 3273     |
| 28   | 斜角标记     | diagonal-corner           | 创意 · 双栏 | [word-1117](https://www.qmjianli.com/resume/details/word/1117) | 3135     |
| 29   | 悬挂姓名牌   | hanging-name-banner       | 创意 · 双栏 | [word-1128](https://www.qmjianli.com/resume/details/word/1128) | 3126     |
| 30   | 双语页边     | bilingual-margin          | 简约 · 单栏 | [word-1108](https://www.qmjianli.com/resume/details/word/1108) | 2986     |
| 31   | 深蓝折角     | navy-folded-corner        | 创意 · 单栏 | [word-1112](https://www.qmjianli.com/resume/details/word/1112) | 2971     |
| 32   | 右侧灰卡     | right-gray-profile        | 简约 · 双栏 | [word-1089](https://www.qmjianli.com/resume/details/word/1089) | 2613     |
| 33   | 像素方格     | pixel-mosaic              | 简约 · 单栏 | [word-1020](https://www.qmjianli.com/resume/details/word/1020) | 2369     |
| 34   | 石墨名牌     | graphite-billboard        | 简约 · 双栏 | [word-1110](https://www.qmjianli.com/resume/details/word/1110) | 2123     |
| 35   | 炭黑圆角     | charcoal-rounded          | 创意 · 单栏 | [word-1011](https://www.qmjianli.com/resume/details/word/1011) | 452      |
| 36   | 彩绘足迹     | paint-splash              | 创意 · 单栏 | [online-1029](https://www.qmjianli.com/cv/details/1029)        | 24778    |
| 37   | 青瓷弧环     | turquoise-arc             | 创意 · 双栏 | [online-1028](https://www.qmjianli.com/cv/details/1028)        | 24097    |
| 38   | 经典表格     | form-grid                 | 简约 · 单栏 | [online-1001](https://www.qmjianli.com/cv/details/1001)        | 24048    |
| 39   | 黑白双旗     | monochrome-pennants       | 创意 · 双栏 | [word-1027](https://www.qmjianli.com/resume/details/word/1027) | 3549     |
| 40   | 天蓝水印栏   | sky-watermark-rail        | 创意 · 单栏 | [word-1136](https://www.qmjianli.com/resume/details/word/1136) | 2995     |
| 41   | 珊瑚旗轴     | coral-banner-rail         | 创意 · 单栏 | [word-1029](https://www.qmjianli.com/resume/details/word/1029) | 2649     |
| 42   | 虚线索引     | dotted-index              | 简约 · 单栏 | [word-1105](https://www.qmjianli.com/resume/details/word/1105) | 2638     |
| 43   | 日落色块     | sunset-quadrants          | 创意 · 双栏 | [word-1013](https://www.qmjianli.com/resume/details/word/1013) | 2489     |
| 44   | 羊皮卷轴     | parchment-scroll          | 创意 · 双栏 | [word-1113](https://www.qmjianli.com/resume/details/word/1113) | 2409     |
| 45   | 橙线账页     | orange-ledger-frame       | 简约 · 单栏 | [word-1033](https://www.qmjianli.com/resume/details/word/1033) | 2310     |
| 46   | 金色对话     | gold-speech               | 创意 · 双栏 | [word-1107](https://www.qmjianli.com/resume/details/word/1107) | 2278     |
| 47   | 薄荷彩屑     | mint-confetti             | 创意 · 单栏 | [word-1037](https://www.qmjianli.com/resume/details/word/1037) | 2194     |
| 48   | 中轴履历     | center-dashed-timeline    | 创意 · 双栏 | [word-1099](https://www.qmjianli.com/resume/details/word/1099) | 2079     |
| 49   | 青蓝右栏     | cyan-right-ribbons        | 创意 · 双栏 | [word-1056](https://www.qmjianli.com/resume/details/word/1056) | 2205     |
| 50   | 橙签说明卡   | orange-callout-rail       | 创意 · 单栏 | [word-1015](https://www.qmjianli.com/resume/details/word/1015) | 1368     |

## 验证证据

- 结构验收：50 × 24 = 1,200 场景，73,600 次主字段完整文本检查、11,000 次模块检查，8 个故障负例均被拒绝。包含模块逆序/交错排序、逐模块隐藏、逐集合条目隐藏与恢复。
- 奇偶能力：103 个可见条目各匹配一个分支，四类非法定义拒绝。
- 每套检查两个真实示例预览及短内容、页底临界、长内容、无照片、长姓名邮箱。18 套双栏另检查主栏长、侧栏长、两栏同时长、空主栏、空侧栏。
- PDF 来自正式 useResumePrint 入口，校验通过后输出背景图形开/关两份；核对实际 A4、完整正文、唯一标记、字符坐标及实际栅格。校验器另验证保留全部段落标记但删除正文单字或整条跨页续文的真实 PDF 仍会失败。
- 默认模板及原双栏模板完成正式打印基线；未通过放宽签名或隐藏正文解决分页问题。
- 最终冻结结果：50 套、100 张示例预览、340 个导出场景，共 680 份 PDF、1,784 页、27,476 次完整段落检查。全部通过，两种背景设置的实际栅格差异为零。最终定义与预览文件哈希逐一匹配发布资源。
- 云端发布已完成：匿名 API 回读目录共 62 套，新增 50 份定义和 100 张预览真实字节哈希全部一致；原有 12 条目录及 16 个历史定义版本保持不变。目录首批 12 套，实际滚动后得到 62 个唯一 ID，筛选往返没有重复云端请求。
- 应用路径：靛蓝报头、彩块履历轴、经典表格、羊皮卷轴、青蓝右栏五种代表均验证两个示例、两轮完整弹窗进入/退出、退出中反向打开及减少动效；离线创建服务、整张卡片进入编辑器、刷新后简历名称，以及实际点击导出均通过，另核验 10 份双背景 PDF。未处理脚本错误、未知非读取请求和实际云端写入均为零。
- 缓存边界：完整 62 套图片超出原有 64 MiB 解码预算，筛选时会回收并重新解码部分图片，完整原始严格检查结果保留；这不等于重复云端请求。四种代表热预览为零请求、零重解码、零加载占位；经典表格所在工作集约 75.1 MiB，7 次本地重解码全部匹配此前实际被淘汰的同一哈希，无网络读取或资源加载占位。未扩大缓存预算，也未移除交互动画。
- 公共字段标签去重：正文已经含同名标签和冒号时，不再额外输出一次标签；完整评论锚点不变。12 个边界、50 套结构场景重验，以及新旧代表和默认模板共 10 份追加 PDF 通过。两个标准示例均未命中新条件，已发布预览无需重建。
- 类型检查、改动范围 ESLint 与生产构建已通过。ESLint 仅余公共渲染器原有数组索引 key 警告。构建仍提示原有 tiptap/radix 循环分块与部分资源超过 500 kB；本轮没有为模板资源增加前端打包入口。

## 复刻边界

实现保留来源的主要结构、配色、页头、照片位置、章签、时间线与装饰，但不是逐像素复制：

- 字体采用项目字体，正文和照片采用项目虚构示例，字形、行数与原站示例不同。
- 日落色块与中轴履历用两个独立内容流组合页头；中轴圆环完整放在中线两侧。羊皮卷轴照片位于右栏页头，未跨两区域居中。
- 足迹、卷轴纹理、水印和邮票边为矢量重绘；部分原稿固定技能图形改为绑定实际熟练度的进度条。
- 表格行高随实际内容增长，所有模板保留用户模块顺序；不会为了原示例排版而丢弃用户内容。
- 珊瑚旗轴、橙线账页依原稿设计不显示照片，其他四十八套使用动态照片节点。

结构检查只对当前公共适配器支持的字段作完整性承诺：既有适配器未映射婚姻状况、政治面貌和自定义基础字段，这属于原有协议缺口，本轮没有扩展或宣称已经覆盖。检查包含每个支持字段的完整文本、主投影唯一次数、模块分区内顺序、隐藏与恢复、照片存在性；出生年月转换为年龄，专业与学历使用现有合并字段。

## 发布与维护

发布分为资源与目录两阶段。分批写入不可变定义和预览后，通过匿名 API 核对真实哈希、尺寸、示例引用及旧目录未变；然后单事务插入五十条目录。目录 ID 冲突、资源缺项和最终数量不为六十二都会阻断事务。style/layout 由数据库根据 metadata.category 生成，不直接写入。

发布前及收尾均进行独立只读审查：已发现的发布生成列和精确幂等检查问题已修复，无未解决实质阻断；审查没有替代实际浏览器和 PDF 验收。

本轮没有数据库迁移或 Edge Function 变更。没有修改用户简历数据，也没有执行 Git 提交或推送。浏览器验证使用独立上下文，创建数据只写隔离 IndexedDB。

定义、原图、预览及大型 PDF 位于系统临时目录，正式模板以云端不可变版本为准。按仓库最新规则，本次新增的 tests/resume-template-fifty 在全部验证后归档并移出仓库；仓库保留本记录、规格与计划，没有重新引入 template-resources 等根目录。

本次原始证据与工具归档位于系统临时工作目录 `resume-qm-fifty-k1n66f7b`：`publication/readback.json` 为线上回读，`validation/<id>/report.json` 为逐模板 PDF 报告，`field-label-validation/projection-final.json` 为最终 1,200 场景结构报告，`cloud-smoke-final/report.json` 为真实应用验收。`verification-tools/` 保存校验过哈希的验收工具归档；模板正式资源仍以云端版本为准。
