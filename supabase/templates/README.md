# GResume Supabase 邮件模板

这组模板包含 6 类认证邮件和 7 类安全通知。视觉沿用 GResume 现有产品风格：黑白卡片、细灰边框、紧凑圆角和品牌蓝；文案采用同一位“嘴硬但靠得住”的助手口吻，但不会在每封邮件里机械重复同一套句式。

每个 HTML 文件都可以单独粘贴到 Supabase Dashboard 的对应模板中。

## 认证邮件

| Dashboard 模板 | 建议主题 | HTML 文件 | 主要变量 |
| --- | --- | --- | --- |
| Confirm sign up | `【GResume】邮箱还没确认——就差这一步` | `confirmation.html` | `ConfirmationURL`、`Email`、`SiteURL` |
| Invite user | `【GResume】有人点名邀请你加入` | `invite.html` | `ConfirmationURL`、`Email`、`SiteURL` |
| Magic link or OTP | `【GResume】登录入口到了——门只开这一次` | `magic-link.html` | `ConfirmationURL`、`Token`、`Email`、`SiteURL` |
| Change email address | `【GResume】请确认你的新邮箱` | `email-change.html` | `ConfirmationURL`、`NewEmail`、`Email`、`SiteURL` |
| Reset password | `【GResume】密码忘了就重设，别硬猜` | `recovery.html` | `ConfirmationURL`、`Email`、`SiteURL` |
| Reauthentication | `【GResume】{{ .Token }} 是你的身份验证码` | `reauthentication.html` | `Token`、`Email`、`SiteURL` |

## 安全通知

| Dashboard 模板 | 建议主题 | HTML 文件 | 专用变量 |
| --- | --- | --- | --- |
| Password changed | `【GResume】安全提醒：你的密码已更改` | `password-changed.html` | `Email` |
| Email address changed | `【GResume】安全提醒：账号邮箱已更改` | `email-changed.html` | `OldEmail`、`Email` |
| Phone number changed | `【GResume】安全提醒：账号手机号已更改` | `phone-changed.html` | `OldPhone`、`Phone` |
| Sign-in method linked | `【GResume】安全提醒：新的登录方式已关联` | `identity-linked.html` | `Provider` |
| Sign-in method removed | `【GResume】安全提醒：一个登录方式已移除` | `identity-unlinked.html` | `Provider` |
| MFA method added | `【GResume】安全提醒：新的多重验证方式已添加` | `mfa-factor-enrolled.html` | `FactorType` |
| MFA method removed | `【GResume】安全提醒：一个多重验证方式已移除` | `mfa-factor-unenrolled.html` | `FactorType` |

## 图片资源

13 个模板各自加载一张对应场景的紧凑角色图：

| 模板 | 图片资源 |
| --- | --- |
| Confirm sign up | `confirmation-assistant-v2.png` |
| Invite user | `invite-assistant-v2.png` |
| Magic link or OTP | `magic-link-assistant-v2.png` |
| Change email address | `email-change-assistant-v2.png` |
| Reset password | `recovery-assistant-v2.png` |
| Reauthentication | `reauthentication-assistant-v2.png` |
| Password changed | `password-changed-assistant-v2.png` |
| Email address changed | `email-changed-assistant-v2.png` |
| Phone number changed | `phone-changed-assistant-v2.png` |
| Sign-in method linked | `identity-linked-assistant-v2.png` |
| Sign-in method removed | `identity-unlinked-assistant-v2.png` |
| MFA method added | `mfa-factor-enrolled-assistant-v2.png` |
| MFA method removed | `mfa-factor-unenrolled-assistant-v2.png` |

资源在邮件中通过 `{{ .SiteURL }}/email/<文件名>` 加载。对应的 PNG 与可编辑 SVG 源文件位于 `public/email/`。角色图不承载按钮、验证码或安全说明，即使邮件客户端拦截远程图片，主要内容和操作入口仍然完整可读。

在 Dashboard 中测试邮件前，应先将当前前端部署到 `Site URL` 对应的地址，否则邮件客户端无法加载本地资源。

## 使用说明

1. 在 Supabase Dashboard 进入 **Authentication → Emails**。
2. 打开对应模板，将表格中的建议主题复制到 **Subject**。
3. 将对应 HTML 文件的完整内容复制到 **Body → Source**。
4. 对 7 类安全通知分别开启右侧开关；未开启的通知不会发送。
5. 确认 **Authentication → URL Configuration** 中的 Site URL 和 Redirect URLs 指向实际生产站点。
6. 逐封发送测试邮件，检查图片、按钮、验证码、变量替换、移动端宽度以及纯文本降级后的可读性。

认证链接继续使用 Supabase 提供的 `{{ .ConfirmationURL }}`，不在模板中重新拼接令牌、类型或回调地址。安全通知没有处置令牌，因此提供账号资料页与忘记密码页入口。

> 注意：自 2026-06-03 起，新建的 Free 计划项目如果继续使用 Supabase 默认 SMTP，将无法自定义认证邮件。此类项目需要配置自定义 SMTP（例如 Resend）后再保存这些模板；已有项目、付费计划和自托管实例不受这项限制。

参考：[Supabase 自定义邮件模板](https://supabase.com/docs/guides/local-development/customizing-email-templates)、[Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)。
