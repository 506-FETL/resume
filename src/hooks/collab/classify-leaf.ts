/**
 * 简历表单叶子字段的协作合并分类。
 *
 * 写路径据此决定字符串叶子的合并策略：
 * - `rich`：富文本（HTML 字符串），整段 LWW（`setLeaf`），避免并发下 HTML 标签交错损坏。
 * - `freeText`：自由文本 `<Input>`，字符级合并（Automerge `updateText`）。
 * - `atomic`（默认）：其余全部（Select 枚举、日期字符串/元组、number、展示型字段、未登记字符串），LWW。
 *
 * 默认 `atomic` 是安全兜底：字符级合并是显式 opt-in 白名单，
 * 因此枚举 / 日期 / number 绝不会被 `updateText` 拆分损坏。
 *
 * 字段名已按 `src/lib/schema/resume/form/*.ts` 逐字段核对。
 */

export type LeafClass = 'rich' | 'freeText' | 'atomic'

/** 富文本（HTML）叶子：按 section -> 末段字段名集合。 */
const RICH_TEXT: Record<string, ReadonlySet<string>> = {
  self_evaluation: new Set(['content']),
  hobbies: new Set(['description']),
  honors_certificates: new Set(['description']),
  skill_specialty: new Set(['description']),
  work_experience: new Set(['workInfo']),
  internship_experience: new Set(['internshipInfo']),
  project_experience: new Set(['projectInfo']),
  edu_background: new Set(['eduInfo']),
  campus_experience: new Set(['campusInfo']),
}

/** 自由文本 `<Input>` 叶子：按 section -> 末段字段名集合。 */
const FREE_TEXT: Record<string, ReadonlySet<string>> = {
  basics: new Set(['name', 'phone', 'email', 'nation', 'nativePlace', 'label', 'value']),
  job_intent: new Set(['jobIntent', 'intentionalCity']),
  application_info: new Set(['applicationSchool', 'applicationMajor']),
  work_experience: new Set(['companyName', 'position']),
  internship_experience: new Set(['companyName', 'position']),
  project_experience: new Set(['projectName', 'participantRole']),
  campus_experience: new Set(['experienceName', 'role']),
  edu_background: new Set(['schoolName', 'professional']),
  honors_certificates: new Set(['name']),
  hobbies: new Set(['name']),
}

/**
 * 取路径末段字段名（跳过纯数字的数组索引段）。
 * 例如 `items.0.companyName` -> `companyName`，`workDuration.1` -> `workDuration`。
 */
function leafFieldName(relativePath: string): string {
  const segments = relativePath.split('.')
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const seg = segments[i]
    if (!/^\d+$/.test(seg)) {
      return seg
    }
  }
  return segments[segments.length - 1] ?? relativePath
}

export function classifyLeaf(sectionKey: string, relativePath: string): LeafClass {
  const field = leafFieldName(relativePath)

  if (RICH_TEXT[sectionKey]?.has(field)) {
    return 'rich'
  }
  if (FREE_TEXT[sectionKey]?.has(field)) {
    return 'freeText'
  }
  return 'atomic'
}
