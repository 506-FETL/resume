# 当前简历更换模板验收

日期：2026-10-23。

## 实现范围

工具栏「模版设置」增加当前模板、选择模板和撤销上次更换。大弹窗使用当前真实内容预览，只有应用操作写入精确模板绑定。保留所有内容、条目 ID、顺序、显隐、照片及外观配置；候选准备期间保留旧预览。图库每页 12 项，定义、图片和底层目录缓存共享。

规格与任务明细分别见 [设计规格](superpowers/specs/2026-10-23-resume-template-switch-design.md) 和 [实施计划](superpowers/plans/2026-10-23-resume-template-switch.md)。没有数据库或 Edge Functions 变更，没有部署或写入云端用户简历。

## 自动与浏览器检查

- `pnpm exec tsc -b --pretty false`：通过。
- 对全部本次修改的 TypeScript/TSX 运行限定 `pnpm exec eslint`：通过。
- `pnpm build`：通过。仍有仓库已有的 tiptap/radix 循环分块和大分块提醒。
- `node tests/resume-template-switch/core.mjs`：真实 Zustand/form helper 的领域验证通过。覆盖只改绑定、过期预览拒绝、内容更新后撤销、外部模板变更、会话/只读清理、本地 CRDT 写入异常回滚与撤销失败重试。异常日志为主动注入。
- `node tests/resume-template-switch/browser.mjs`：独立 Chrome context、真实编辑器路由、公共云端模板读取与隔离 IndexedDB 简历。应用前后和撤销后深比较通过，控制台无异常。
- `node tests/resume-template-switch/browser-edge.mjs`：快速连续选择仅展示最新候选；内容/外观更新使旧签名失效；外部绑定变化保留候选并显示提醒；撤销保留后续内容及主题；缓存候选切回没有新的模板定义请求。
- 同一浏览器边界检查覆盖完整缓存离线应用、未缓存候选的「联网后可使用」与按钮禁用、移动端选择/预览视图、只读入口禁用、离开编辑器清除撤销。离线注入产生的 `ERR_INTERNET_DISCONNECTED` 是预期错误，未观察到 React 或 DialogDescription 警告。
- 弹窗遮罩和内容各完成两轮开/关，退出中重新打开成功；减少动效时两者 animation-duration 均为 0。

协作边界通过向真实表单 store 投影外部绑定/正文变化验证，并结合核心条件写入审查；未冒用用户账号执行两个已登录客户端的云端实时协作测试。

`node tests/resume-template-switch/catalog.mjs` 补充验证首次 12 项、滚动追加 12 项、下一分页偏移 24；在隔离缓存中模拟同模板新版和下架，确认旧版不自动升级、新版显式应用、当前下架项可见、筛选不强行包含不匹配当前项。该模拟没有发布模板或修改云端目录。

## 真实 PDF

`node tests/resume-template-switch/pdf-run.mjs` 经真实「选择模板 → 应用模板 → 导出简历 → 导出 PDF」入口，完成 3 套模板 × 3 种内容 × 背景图形开/关，共 18 份最终文件。

| 精确模板版本 | 短内容 | 临界内容 | 多页长内容 | 临界距页底 |
| --- | --- | --- | --- | --- |
| default@3 | 1 页 | 1 页 | 2 页 | 0.46 px |
| classic-ribbon@3 | 1 页 | 1 页 | 3 页 | 18.52 px |
| navy-sidebar@1 | 1 页 | 1 页 | 4 页 | 15.87 px |

实际 PDF 的逐段正文、唯一标记、页数、A4 字形边界和无空白页检查全部通过。两种背景设置逐页栅格平均通道差均为 0，蓝金饰条、折带标题及深蓝侧栏装饰保留，已检查三套模板短/临界/长内容首尾页。

导出在正式打印 hook 完成字体、图片和稳定性校验后的 `window.print` 边界截取未经修改的打印副本，再由同一 Chrome PDF 引擎输出；没有操作系统打印弹窗的人工点击。未修改公共打印/分页算法或放宽签名校验。本轮不代表其余所有模板，也未额外覆盖双栏两个区域同时超长的组合。

## 审查与证据

核心规格/质量审查通过。最终审查发现的菜单键盘可达性问题已修复为 DropdownMenuItem 注册项，并通过独立复审。`node tests/resume-template-switch/keyboard.mjs` 验证 Enter/ArrowDown 打开、Esc 焦点返回、应用后键盘撤销与完整快照恢复；浏览器错误为空。

截图、浏览器请求与动画状态、PDF/字形/像素报告，以及临时验收脚本归档目录：`/tmp/resume-template-switch-Qt0ZVT/`。验收脚本仅在本次工作期间位于 `tests/resume-template-switch/`，已归档至 `verification-tools/resume-template-switch/` 并移出仓库，按仓库约定不保留新增测试目录。
