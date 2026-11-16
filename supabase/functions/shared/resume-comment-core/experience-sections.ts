import type { ProjectedNodeInput } from './types.ts'
import {
  readArray,
  readRecord,
  buildEntryId,
  readString,
  formatCommentDuration,
  pushTextNode,
  pushRichTextNode,
} from './projection-values.ts'

export function projectExperienceCollection(
  target: ProjectedNodeInput[],
  sectionKey: string,
  collectionKey: string,
  entries: unknown,
  fields: {
    title: string
    titleFallback: string
    subtitle?: string
    subtitleProject?: (entry: Record<string, unknown>) => string
    duration: string
    content: string
    visibilityFields?: string[]
  },
) {
  const usedIds = new Set<string>()

  readArray(entries).forEach((value, index) => {
    const entry = readRecord(value)

    if (entry.hidden === true) {
      return
    }

    const entryId = buildEntryId(
      sectionKey,
      collectionKey,
      index,
      entry,
      usedIds,
    )

    const subtitle = fields.subtitleProject
      ? fields.subtitleProject(entry)
      : fields.subtitle
        ? readString(entry[fields.subtitle])
        : ''

    const duration = formatCommentDuration(entry[fields.duration])

    const visibilityFields = fields.visibilityFields ?? [
      fields.title,
      ...(fields.subtitle ? [fields.subtitle] : []),
      fields.content,
    ]

    if (
      !visibilityFields.some((field) => Boolean(readString(entry[field]))) &&
      !duration
    ) {
      return
    }

    pushTextNode(
      target,
      sectionKey,
      entryId,
      fields.title,
      entry[fields.title],
      fields.titleFallback,
    )

    pushTextNode(
      target,
      sectionKey,
      entryId,
      fields.subtitle ?? 'subtitle',
      subtitle,
    )

    pushTextNode(target, sectionKey, entryId, 'duration', duration)

    pushRichTextNode(
      target,
      sectionKey,
      entryId,
      'content',
      entry[fields.content],
    )
  })
}
