# 产品 IP 图标验收

日期：2026-11-11。配置状态补记：2026-11-12。

## 实施与审查状态

已用首页的无脸黄色文件夹 IP 重绘透明品牌 SVG，保留浅蓝纸张、双层口袋、奶油标签、小蓝印章、挥手手套和蓝球鞋。主图标没有微小文案。favicon 单独精简为文件夹、纸张和手套；手机图标由 `scripts/render-brand-icon.py` 从 SVG 生成，采用暖纸背景。

首轮粗糙草稿不再作为交付版本。经实际查看 [Jane Song 的 Mailchimp 插画系统](https://www.jane-song.com/mailchimp-illustration-system)与 [Open Doodles](https://www.opendoodles.com/) 并重绘后，用户明确选择“沿用这版，继续细化”，批准代表样张与图标方向；全部最终图像仍待用户审查，不把方向批准写成最终批准。

## 已执行检查

- 品牌与 favicon SVG 的 XML、title、desc 有效，不包含外链、外字体、脚本、动画、滤镜和内嵌栅格。
- 主品牌 SVG 为 512×512，favicon 为独立 32×32 源，Apple 图标为 180×180。
- 通过 `view_image` 实际查看 512px 品牌图，修复手腕与双腿断接。
- 实际查看明暗背景联系表：品牌源在表中显示为 430px，Apple 为原始 180px，favicon 为原始 16/24/32/48px。小尺寸保留黄色文件夹与奶油手套轮廓；16px 不承载纸张和手套细节。
- 使用最终 SVG 执行手机生成器两次，Apple PNG 的 SHA-256 一致。生成器通过 Python AST 语法检查。
- SVG 使用 Prettier HTML parser 排版，`git diff --check` 通过。

联系表：`/Users/shemingcong/.codex/visualizations/2026/11/11/01a1c9cc-4724-7412-9116-4741926445a8/brand-icon-final.png`。

## 实际入口与构建检查

主任务已在 index.html 配置 `/favicon.svg` 与 `/apple-touch-icon.png`，本次读取确认两条 link 均存在；侧栏 `src/components/dashboard/app-sidebar.tsx` 已切换为 `/favicon.svg`，在 20px 尺寸使用简化文件夹轮廓，避免完整角色缩小后细节不清；主任务已在真实侧栏确认该图片成功加载，实际显示 20px、自然宽度 32px，引用与简化图源相符。首页动画未修改。

主任务已执行 `pnpm build` 与 `pnpm format:check`，两者退出码均为 0；格式检查中的 ESLint 结果为 68 条已有警告、0 个错误。应用与 Node 两份 TypeScript 配置的类型检查也均退出 0。以上是主任务实际命令结果，不以静态插画检查替代构建或类型检查。

## 验收边界

已在原生 Chrome 的正常窗口和本次独立无痕窗口实际查看标签图标；黄色文件夹和奶油手套可辨识。实际浅色、深色侧栏均已查看，小尺寸图标与文字比例正常。前端尚未部署。实施完成、上述验证通过、用户最终整组审查待进行，三者分别记录。

`tests/email-art/` 临时预览与脚本已清理；交付联系表保留在会话展示目录。长期真源为两张 SVG，Apple PNG 通过现有维护脚本重新生成。
