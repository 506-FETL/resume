# 助手资料与出处缺口补齐验收

日期：2026-11-14。范围沿用已授权的 assistant-harness 规格 6.6、7.3、7.4、10 及规格复查计划；保留新版经历资料库布局、既定引用标签与队列布局。实施完成，本地验证通过；真实模型/云端部署/检索语料矩阵由主任务统一集成，用户产品审查待进行。前端尚未发布。

## 实现

- 出处从同一 assistant 消息内成功的经历搜索/读取工具结果重建，按 source/version/block 限定；带引号摘录及 URL quote 必须存在于该段真实文字。错误来源、版本、段落和摘录显示“来源暂不可定位”。显示真实资料名称及实际页/段；原文读取后标题取实际 name，保留指定旧版本。
- 输入框上方提供“本对话资料 · N”折叠入口，计数由真实关系元信息生成，加载和失败不报 0。保留队列紧邻输入框及原有三条内部滚动；移除 Header 重复入口。
- “本轮查找全部经历资料”是明确用户操作，按 10 条分页取得本人资料元信息，正文仍由工具按需读取。模型 all 参数或资料中的文字不授予全库范围。每次提交冻结来源版本；队列等待期间的关系变化不修改已入队快照。已发送 user parts 保存 source-scope，消息和队列可折叠检查当轮资料。执行前仅核对这些固定 ID 的可用状态，不扩大范围或替换旧 versionId。
- 原文工具增加最多 8 个 blockIds，和 offset 互斥；保留顺序分页、未命中换词/浏览提示和缺段错误。工具政策沿用 selected-sources。
- 新 read_resume_preparation 从运行 target 取 owner/resume，先检查目标可访问，再读本机 IndexedDB。区分没有记录、记录为空和读取失败；每次最多 8 段、每段 2000 字符，保留真实文字位置，导入/AI/模板示例身份分开。不上传旧原文、不发起模型调用。
- 新 metadata Edge action 仅投影 id/name/status/currentVersionId/updatedAt，最多 100 个 ID，按认证 owner 过滤；共享缓存按账户代次/资料修订失效，同帧标签请求合并。已删除与状态读取失败分开，标签及回答出处刷新能恢复删除状态，查看原文不逐标签下载正文。
- 上传任务每次可重试启动新 AbortController，动态提取模块加载返回先检查取消，继续使用同一 operationId 与冻结内容。
- 删除遇未知结果先核对 metadata；目标明确不存在时清缓存并收敛，仍存在时保留实际 deleting/delete-failed 与重试，核对失败保持 unknown。再次恢复先核对，不用任意 404 认定成功。
- 附带修复两项真实运行审查问题：存在待补存结果时，历史编辑/重新生成不截断或启模型，相关按钮禁用；A 已开始 apply 后切到 B，清除旧确认卡，A 真实结果继续完成，旧回调不回填 B。

## 本地验证

独立 headless Chrome，使用原 5194 服务；真实组件、真实 Zustand store、真实前端 API、真实 IndexedDB，外部传输受控，不读取或修改真实用户资料。脚本位于临时 `tests/assistant-spec-audit/evidence-implementation/`，由主任务汇总后按仓库要求清理。

`node tests/assistant-spec-audit/evidence-implementation/browser.mjs`：18 组通过，pageerror 0。覆盖正确出处、伪造摘录/段/版本、其他轮同 ID、普通链接与代码；Enter、旧版本及实际名称；两轮弹窗开关、退出中重开、运行中减少动效；blockIds 上限/互斥/越范围/缺段/顺序页；IndexedDB owner 隔离、无记录/空/真实存储打开失败及 AI/示例身份；全库 23 条的 10/10/3 仅元信息请求与冻结版本；320/390px 折叠无横溢；删除丢响应、Storage 部分失败、核对失败恢复、历史 tag 刷新；慢提取分包取消后重试仅保存一次、真实 TXT 文件读取中取消再重试；两项运行审查问题；旧工具重试独立分页找到原用户范围、保留旧版本/目标、缺目标拒绝及 null 不回退；sessionStorage 真实刷新恢复不丢工具与来源目标。

`DENO_NO_PACKAGE_JSON=1 pnpm dlx deno test --allow-read --no-config --no-lock --node-modules-dir=none tests/assistant-spec-audit/evidence-implementation/metadata-contract.test.ts`：3 passed / 0 failed，真实入口解析覆盖 metadata 去重、空范围、100 项上限与非法 UUID。

`DENO_NO_PACKAGE_JSON=1 pnpm dlx deno check --no-config --no-lock --node-modules-dir=none supabase/functions/experience-sources/index.ts`：通过。需要统一部署的函数为 experience-sources，无新增迁移。

改动源码执行局部 Prettier、ESLint layout 修复及 TypeScript 检查，具体命令见子任务报告；类型检查不代替上述真实边界验收。真实模型、云端 owner/RLS/部署 smoke 及中文/别名/跨段语料矩阵不在本子任务结果中冒充完成。

## 本轮根因与长期约束

真实浏览器首轮发现 Streamdown 会按 rehype 插件函数名称缓存 processor；把本轮证据闭包捕获在插件中，会被另一个消息实例复用，导致相同 ID 获得其他轮的可定位资格。已改为无状态 rehype 转换与 TextPart 子树局部证据 Context，证据由实际消息 parts 重建；验收必须在同一页面同时渲染有证据与无证据的两个消息，后者不能获得前者的资格。

来源范围必须在入队前成为确定版本列表；执行时只核对该列表现存状态。未知范围/失败不得替换为空范围，新版本不得偷偷替换队列 versionId。metadata 网络失败与查无可访问来源分开，删除 unknown 的再次操作必须先核对。

旧消息重试继续使用原轮 source-scope；原用户不在 UI 页时独立分页查找，不回退当前会话关系。工具目标优先实际 execute 前记录的 tool-call.targetResumeId（包括显式 null）；仅在未记录时回退同轮 source-scope.targetResumeId，仍无目标的旧 target-resume 工具要求重新生成，不能沿用当前已改绑的简历。草稿恢复 schema 必须保留这两处目标字段。

## 主任务集成补充

本子任务交付后，主任务已部署 metadata 到 experience-sources version 2，完成真实云端 owner/匿名/删除状态/地区/零模型费用检查、六组中文检索矩阵以及实际模型建议到确认保存。正式助手三种宽度的出处原文各两轮开关及回焦通过。详见 [总验收末节](2026-11-14-assistant-harness-acceptance.md)。本子任务原先标注的统一集成待办已完成，用户审查仍待进行。
