# 分享联系方式占位验收

所有数据是本轮合成样本，测试结束后删除本目录。不得打印或复制项目凭据、会话令牌及评论凭据。

- `node --test tests/resume-workflow/privacy/verify-projection.test.mjs` 直接导入真实服务端投影与内容哈希，覆盖四种显隐组合、空值、别名、重复正文与链接、输入不变及评论策略。
- `verify-online-privacy.mjs` 只有带 `--run-online` 才创建一个明确合成账号，使用真实发布及设置协议验证 current/history 和旧评论凭据。必须等 `resume-share` 部署并经主代理审阅后执行。凭据仅从相邻 database/project-keys.json 在内存读取，日志仅含步骤、状态与地区；finally 删除本轮分享、简历、账号，并核对版本、范围及发布批次清零。
- 浏览器入口：`http://localhost:5173/tests/resume-workflow/privacy/index.html?revision=1`。它挂载真实 `ResumeSharePage`、分页与 PDF 按钮，仅用 fetch 边界提供经过真实投影函数处理的合成快照；其他外部请求与写入均拒绝。本地 storage 隔离，默认模板资源来自本轮已取得的真实公开资源。
- 控制按钮包括“隐藏电话”“隐藏邮箱”“都隐藏”“都显示”“原空字段”，以及短、临界、多页内容。检查字段顺序、标签和 `XXXXXXX`；点击真实“下载 PDF”，分别检查背景图形关闭/开启的文件，核对正文原值不存在、分页与视觉。临界样本只是候选，需要实测页底后调整，不能未经测量声称临界已覆盖。
- fixture 不替代真实接口权限和部署验收；浏览器尚未操作，须等主代理恢复 CUA 连接后验收。
