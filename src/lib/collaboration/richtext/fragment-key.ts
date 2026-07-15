/**
 * 富文本字段 -> Yjs `Y.XmlFragment` 的稳定命名键。
 *
 * 每个协作编辑器绑定一个由 section + RHF 字段相对路径拼成的 fragment：
 * - section 级：`self_evaluation.content`、`hobbies.description` …
 * - 数组项级：`work_experience.items.0.workInfo` …（索引式，与子项目 A 的位置语义一致）
 *
 * 纯函数，无 `@/`/Yjs 依赖，便于 `node --test`。
 */
export function buildFragmentKey(sectionKey: string, relativePath: string): string {
  return relativePath ? `${sectionKey}.${relativePath}` : sectionKey
}
