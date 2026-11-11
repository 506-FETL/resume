# 创建流程临时验收入口

入口：`http://localhost:5173/tests/resume-workflow/creation/index.html?revision=5`。

使用真实 `CreateResumeCard`、草稿 store、`useCreationFlow`、`prepareTemplateResume`、幂等创建 store 与离线持久化。localStorage/sessionStorage 使用内存；IndexedDB 均以 `resume-workflow-creation:` 为前缀。公开目录为本轮读取的真实 24 项，默认模板 v3 复用历史验收资源，其余模板只允许读取已发布的公开资源，远端非 GET 请求全部拒绝。

- 从零：打开创建简历 → 从零整理经历 → 选择人群 → 选择模板 → 比较并选中 → 下一步 → 名称/描述 → 创建。清空名称应保存为“示例简历”，描述移除首尾空白。
- 导入：准备导入示例 → 我有旧简历 → 填入简历 → 核对结果 → 选择模板 → 下一步 → 创建。检查保存结果中的正文姓名和输入原文一致、不混入从零示例。
- 未确认重试：先点击“下次响应丢失”，再正常创建。真实本地写入完成后模拟响应丢失，表单锁定；关闭再打开，主动继续创建并重试。实际插入次数不得增加，名称/描述/操作 ID 保持不变。
- 动效：1440、390、320px 与 400px 短屏，分别选首行和滚动后模板。连续两轮下一步/返回，进入或退出未结束时反向；返回时已选项可见并恢复焦点，已在视口内则保留目录 scrollTop，表单输入不丢失；页头/页脚常驻，长描述在正文区域滚动。
- 详情视觉：桌面真实选中模板铺满正文左侧并向右渐隐，表单在右侧居中；手机保持全宽向下渐隐背景，高约 320–384px，顶部 40% 清晰，后段淡出，表单从最后 24px 的近透明区衔接。共用一个正文滚动层，页脚固定。详情成品预览不得有选择描边、勾选图标或标题条；错误状态允许真实重试按钮。图片为 object-cover / top，深色背景应自然融入弹窗底色。
- 模板页原窗口创建的目录夹具和独立脚本已经完成并清理，证据见[原地创建验收](../../../docs/superpowers/specs/2026-11-11-template-inline-creation-acceptance.md)。此处保留此前尚待完成的恢复与加载等浏览器场景，不再包含旧的跨窗口交接入口。
- 恢复与加载：六个恢复按钮准备末屏的真实模板，再点“继续创建”。慢目录、慢图片分别延迟真实读取和 decode 2.2 秒；失败只注入一次，使用生产重试按钮应恢复；缺失明确显示缺失。未完成时只显示 Spinner，不能显示 FileText。返回模板后必须滚到恢复的末屏卡片。
- 逐帧采样：点击弹窗内“开始动画采样”，再点“下一步”或“返回”。也会自动捕获这两个按钮的 pointerdown；600ms 内的反向切换保留在同一记录。结束后只读 `document.querySelector('#creation-animation-sample').textContent`，内容含每帧选中卡/背景矩形与 transform、其他卡 opacity、表单 opacity/transform、目录与详情 scrollTop；background 还记录 maskImage、borderWidth、objectFit、objectPosition 和按钮/描边/标题/图标数量，detailsLayout 记录预览底部和表单顶部，selectedSlotVisible 记录已选项是否可见。`data-state=complete` 表示完成。可重复点击采样按钮重新记录，不提供 window 状态修改接口。
- 动态减少动效：弹窗右上角“减动效关/开”是实际按钮，动画中点击应直接进入最终布局，无延迟；关闭弹窗后也有同名功能按钮。只模拟媒体查询 change 事件，不代表操作系统级 CSS 媒体查询已改变。
- “运行数据边界检查”执行真实 flow 的从零/导入空白兜底、描述保存、正文来源、未知重试、旧草稿和显式清空兼容；同时执行真实准备/创建 store 的账户隔离检查。结果直接显示在页面。
- 已完成的独立 Node 验证脚本按仓库要求清理，11 组目录/flow 与 5 组创建流水线均通过，过程不发外部请求；证据见 [返修验收](../../../docs/superpowers/specs/2026-11-11-creation-tracker-followup-acceptance.md)。当前目录仅保留尚待浏览器验收的入口及运行时依赖。
- 完成后关闭创建弹窗，点击“清理临时数据”。若被阻塞，关闭其他创建验收标签页再重试；清理后继续验收需要刷新。主代理最终删除本目录。

Vite 忽略 tests watcher；修改夹具后应同步递增 HTML 的 bootstrap query 与 bootstrap 动态引用的 render query，避免读取旧模块。render 不回引 bootstrap，不会重复安装隔离层。
