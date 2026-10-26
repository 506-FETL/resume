import type { TemplateResumeData } from './context/resume-data-context'
import { buildCommentAnchorDocument } from '@/features/resume-comments/anchors/document'
import { adaptResumeContent } from '@/lib/resume-template/content/adapt-resume'

function buildProjection(data: TemplateResumeData, referenceDate: string) {
  const { document } = buildCommentAnchorDocument(data, referenceDate)
  const nodes = new Map(document.nodes.map((node) => [node.nodeKey, node]))

  return { nodes, content: adaptResumeContent(data, nodes) }
}

const projections = new WeakMap<
  TemplateResumeData,
  { referenceDate: string; value: ReturnType<typeof buildProjection> }
>()

/** 同一不可变快照的测量页、展示页共用投影；旧数据随 WeakMap 键释放。 */
export function getTemplateProjection(
  data: TemplateResumeData,
  referenceDate: string,
) {
  const cached = projections.get(data)

  if (cached?.referenceDate === referenceDate) return cached.value

  const value = buildProjection(data, referenceDate)

  projections.set(data, { referenceDate, value })

  return value
}
