# 邮件手绘插画升级实现计划

> **面向 AI 代理的工作者：** 使用 subagent-driven-development 按任务实现并审查；用户授权与仓库规则优先，不创建分支、不提交、不推送，不执行 TDD。

**目标：** 13 封邮件均采用与首页一致的原创手绘卡通场景。

**架构：** SVG 是源，PNG 由已有 macOS sips 批量生成，保持邮件资源 URL。邮件业务内容与认证链路不变。

**技术栈：** SVG、Python 标准库、sips、现有邮件 HTML。

---

### 任务 1：场景与矢量绘制

文件：public/email/\*-assistant-v2.svg，场景清单记入验收文档。

- [x] 逐张重新设计确认、邀请、登录、密码恢复、邮箱更换、重新验证、密码已改、邮箱已改、手机已改、关联、解除关联、添加 MFA、移除 MFA。
- [x] SVG 每图使用独立可读 title/desc、420 × 240 viewBox、明确的角色姿态和动作道具。
- [x] 在 250px 邮件实际显示宽度检查，修复边界裁切、手脚穿插和过细线条。

### 任务 2：生成邮件副本

文件：scripts/render-email-art.py、public/email/\*.png、supabase/templates/README.md。

- [x] 生成器逐个读取源 SVG，调用 sips，检查返回码与输出尺寸；不安装新依赖。
- [x] 执行 `python3 scripts/render-email-art.py`，得到恰好 13 张 420 × 240 PNG。
- [x] 重复生成并比较 SHA-256，确认相同源得到相同副本；README 写明实际命令和源文件关系。
- [x] 核对 13 封 HTML 引用仍存在，alt 与插画场景相符，确认变量和链接不变。

### 任务 3：审查与交付

文件：tests/email-art/（临时）、docs/superpowers/specs/2026-11-11-email-handdrawn-acceptance.md。

- [x] 从实际生成副本输出联系表，逐张视觉审查，检查透明和白色背景及手机显示。
- [x] 读取本地邮件正文，检查图像不承载必要操作；无需发送真实邮件。
- [x] 在真实浏览器检查 13×320/390/600px 共 39 个正式 HTML 副本视图，图片全部加载、显示 250×143px、无横向溢出；证据见邮件验收记录。
- [x] 对修改文档执行 Prettier，相关代码执行适用的格式与语法检查，运行 git diff --check。
- [x] 记录生成结果、检查范围及前端未发布状态；用户审查保持独立。
- [x] 清理本期临时脚本与数据。
- [x] 主任务完成 `pnpm build`、`pnpm format:check` 和应用 / Node 类型检查，退出码均为 0；68 条已有 lint 警告、0 个错误，结果已记录。
- [ ] 用户审查全部最终图片（当前仅样张方向已批准）。

### 任务 4：产品 IP 图标（用户追加授权）

文件：public/resume_icon_transparent.svg、public/favicon.svg、public/apple-touch-icon.png、scripts/render-brand-icon.py、index.html、docs/superpowers/specs/2026-11-11-brand-icon-acceptance.md。

- [x] 参考首页真实文件夹角色设计紧凑的正方形品牌 SVG，保留黄色身体、奶油手套和蓝鞋的手绘识别点。
- [x] 绘制 16–32px 适用的简化 favicon SVG；维护工具从品牌 SVG 生成 180px 暖纸底手机图标。
- [x] index.html 更新 SVG favicon 并添加 apple-touch-icon；侧栏 20px 图标改用简化 favicon.svg。
- [x] 查看 16/24/32/48/180/512px 明暗背景联系表；XML、引用、图片尺寸、重复生成哈希与差异检查通过。
- [x] 主任务在真实侧栏核对图标成功加载，显示宽度 20px、自然宽度 32px。
- [x] 核对 index.html 的浏览器标签图标与 Apple 图标资源配置。
- [x] 在原生 Chrome 实际核对标签图标，并记录浅色 / 深色侧栏检查。
- [x] 记录实施与验证证据，前端未发布与用户审查单独注明。
- [x] 清理本期图标临时文件（tests/email-art 已删除，交付图片保留在会话展示目录）。
