# AI 助手内置 Skill 设计

日期：2026-09-17。状态：用户已在对话中确认 Codex 式交互与执行机制，允许推进实现。

## 目标与范围

在现有 AI 助手中内置 ASu 简历提升，提供技能发现、结构化点名、自然语言匹配、按需加载、真实活动轨迹及多轮继续工作。保留 DeepSeek、现有简历数据工具、字段校验、Diff 确认与画布。第一期只承诺经过产品适配的指令与参考资料能力；不提供任意第三方插件安装、Shell/Python 沙箱或新的技能管理页面。

## 交互

- 输入框现有工具菜单增加「技能」入口，展示 ASu 简历提升、用途、来源；支持搜索与键盘选择。
- 选择技能后显示可移除标签，提交结构化技能引用，不把全文填进输入框。支持 `$great-resume` 及 `/great-resume` 点名，`asu` 作为产品别名。明确的未知技能给出错误，不静默降级为普通聊天。
- 用户可以说「用 ASu 优化简历」；模型根据技能目录调用 `activate_skill`。普通无关问题不自动加载正文。
- 真实加载成功后显示「本次使用 ASu 简历提升」；参考资料读取显示具体资料名称。失败、取消必须显示真实状态，不模拟完成过程。
- 后续继续同一任务时，模型可以重新加载历史技能版本；历史活动不等于永久技能模式。新会话和切换对话不得继承未发送的技能选择。
- 用户仍可停止、编辑并重新生成；显式引用在持久化、重试、重生成中保留。编辑时展示可编辑的点名文本，删除点名即可移除引用。

## 技能包与来源

应用级技能放在 `src/lib/ai/skills/`，不扫描开发工具的 `.agents/skills/`。

- `catalog.ts`：轻量可用技能目录，不导入正文；包含稳定 id、产品版本、中文名、简介、来源和可读取资源清单。
- `loader.ts`：通过 Vite 动态 raw import 加载内置 Markdown。只接受目录内登记的技能、版本和资源；拒绝路径穿越、URL、任意脚本。
- `builtin/great-resume/`：标准 `SKILL.md`、产品适配的证据规则和业务分析参考资料、MIT 许可及固定上游 commit 来源说明。
- Skill 明确使用 `get_resume_detail` 等已有工具读取用户授权的简历；缺少证据时追问，禁止编造数字和个人贡献。文件账本改为对话中的事实与待确认清单；不调用未接入的 ASu 技能或本地 Python。

## 运行流程

1. 提交时将选中技能和输入中的明确点名解析成 `skill-reference` 消息 part，存储在现有 JSONB parts 内。
2. 每个 `runAgent` 创建独立 Skill runtime。全局只共享只读目录和静态模块缓存，激活状态不共享。
3. 系统上下文默认只包含名称、描述、激活规则。明确点名的技能由程序在首次 LLM 请求前加载，并发送真实 `skill-activity` 事件；加载失败即结束本轮并给出原因。
4. 自动匹配通过运行期 `activate_skill` 工具加载正文。`read_skill_resource` 只读取已加载技能的登记资源。重复加载返回提示，避免在一轮中重复加入全文。
5. 旧消息转换时保留技能来源与版本摘要，移除历史加载工具结果中的长正文。继续任务需要再次激活该版本，防止旧规则永久支配新任务、正文重复膨胀。
6. 现有业务工具继续执行，并接收本轮中止信号；每次工具执行、申请确认与实际应用前检查取消，防止异步预读结束后弹出旧确认卡。已经确认并开始执行的写入保留真实结果，不承诺停止可以回滚；简历修改保持现有 Zod 校验和用户确认。
7. 技能版轮次预算设为有界的 12 轮；取消、额度失败和会话切换继续沿用现有逻辑。已发生的技能/工具活动尽量持久化，避免界面清空真实进展。

## 接口约定

```ts
interface SkillDefinition {
  id: string
  version: string
  displayName: string
  description: string
  sourceLabel: string
  sourceUrl: string
  resources: readonly { path: string, title: string }[]
}

// 目录无正文；loadSkill / readSkillResource 返回真实文件内容。
getSkillDefinition(id: string): SkillDefinition | undefined
loadSkill(id: string, version?: string): Promise<SkillDefinition & { instructions: string }>
readSkillResource(id: string, path: string, version?: string): Promise<{ path: string, title: string, content: string }>

// 页面 store 中的待发送选择，发送与切换会话后清除。
composerSkillIds: string[]
setComposerSkillIds(ids: string[]): void
// 返回是否已接受发送；非法点名时保留草稿。
sendMessage(text: string, skillIds?: string[]): boolean
```

`AiMessagePart` 增加 `skill-reference`（skillId、version、displayName）及 `skill-activity`（id、skillId、version、displayName、state: loading/ready/error、error?）。自动调用及资料读取沿用真实 tool-call 事件与结果。旧消息保持兼容。

## 全局约束

- 默认在当前分支工作；不推送远端。
- 不修改数据库表、迁移或 Edge Function；使用已有消息 JSONB 存储契约。
- 新增页面组件按 kebab-case 文件夹导出，共享选择状态放在页面 Zustand store。
- 所有新增动效使用 `src/lib/motion.ts` 预设与 `useReducedMotion()`；所有新增 Dialog 如有必须关联 Description。
- 不绕过现有写入确认，不新增网络访问或任意代码执行权限。

## 验收

- 菜单搜索、键盘选择、标签删除、明确点名、未知技能反馈、移动端布局正常。
- 明确调用实际加载正文并产生活动；普通对话只带目录；自然语言可通过工具加载。
- 资源越界和未知版本被拒绝；重复加载不重复返回全文。
- 多轮历史保持工具调用与结果的正确顺序；历史技能正文不重复注入；重生成保留引用。
- 切换会话不串用技能选择；停止后不再执行后续写操作；错误保留已发生进展。
- ESLint、生产构建、针对运行时边界的验证脚本、浏览器关键路径检查通过；真实模型调用可用时验证完整对话，否则明确记录验证限制。

## 参考

- https://learn.chatgpt.com/docs/build-skills
- https://agentskills.io/client-implementation/adding-skills-support
- https://github.com/Hisn00w/ASu-skills

## 使用与维护

在 AI 助手输入 `$asu`，从候选中选择「ASu 简历提升」后填写任务并发送；也可以直接发送 `$great-resume 请帮我优化项目经历`。自然语言「用 ASu 帮我优化简历」通过模型工具选择激活。前者由程序确定加载，后者取决于模型的工具选择。

后续新增内置技能时，在 `src/lib/ai/skills/builtin/<id>/` 编写 `SKILL.md` 和参考资料，在 `catalog.ts` 注册元数据，并为 `loader.ts` 增加对应 id 的静态动态导入映射和资源白名单。需要短别名时同步引用解析和菜单搜索。仅新增文件不会自动安装技能；也不会获得新的业务工具或脚本执行权限。

技能正文更新时递增产品版本；本期只保留一个可运行版本。历史引用指定的版本不可用时会明确报错，需要重新选择当前技能；不会静默换成新规则。

## 验收状态

本期实现与独立审查已完成。运行验证、浏览器范围、基线类型错误及真实模型验证限制见同日期实现计划的「完成记录」。
