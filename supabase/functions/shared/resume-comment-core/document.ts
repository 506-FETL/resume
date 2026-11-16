import type {
  ProjectedNodeInput,
  CommentAnchorDocumentNode,
  CommentAnchorDocumentResult,
  CommentAnchorDocument,
} from './types.ts'
import { normalizeCommentText, countCommentGraphemes } from './text.ts'
import { sha256Hex } from './hash.ts'
import {
  readRecord,
  normalizeProjectionReferenceDate,
  readArray,
  readString,
} from './projection-values.ts'
import { projectSingletonSections } from './singleton-sections.ts'
import { projectCollectionSections } from './collection-sections.ts'
import { COMMENT_SECTION_ORDER } from './sections.ts'
import { stableStringify } from './identity.ts'

function toAnchorDocumentNode(
  input: ProjectedNodeInput,
): CommentAnchorDocumentNode {
  const normalizedBlocks = input.blocks
    .map((block) => normalizeCommentText(block.text))
    .filter(Boolean)

  const text = normalizedBlocks.join('\n')
  let cursor = 0

  const blocks = normalizedBlocks.map((blockText, ordinal) => {
    const startGraphemeOffset = cursor

    cursor += countCommentGraphemes(blockText)

    const block = {
      ordinal,
      startGraphemeOffset,
      endGraphemeOffset: cursor,
    }

    cursor += 1

    return block
  })

  return {
    nodeKey: `${input.sectionKey}/${input.entryId}/${input.fieldKey}`,
    sectionKey: input.sectionKey,
    entryId: input.entryId,
    fieldKey: input.fieldKey,
    text,
    blocks,
    nodeTextHash: sha256Hex(text),
  }
}

export function buildCommentAnchorDocument(
  resumeValue: unknown,
  projectionReferenceDateValue: string | Date,
): CommentAnchorDocumentResult {
  const resume = readRecord(resumeValue)

  const projectionReferenceDate = normalizeProjectionReferenceDate(
    projectionReferenceDateValue,
  )

  const sections = projectSingletonSections(resume, projectionReferenceDate)

  projectCollectionSections(resume, sections)

  const visibility = readRecord(resume.visibility)
  const requestedOrder = readArray(resume.order).map(readString)

  const orderedSections = [
    ...requestedOrder.filter((key) =>
      COMMENT_SECTION_ORDER.includes(
        key as (typeof COMMENT_SECTION_ORDER)[number],
      ),
    ),
    ...COMMENT_SECTION_ORDER.filter((key) => !requestedOrder.includes(key)),
  ].filter((key, index, all) => all.indexOf(key) === index)

  const nodes = orderedSections.flatMap((sectionKey) => {
    if (sectionKey !== 'basics' && visibility[sectionKey] === true) {
      return []
    }

    return sections[sectionKey].map(toAnchorDocumentNode)
  })

  const document: CommentAnchorDocument = {
    version: 1,
    projectionReferenceDate,
    nodes,
  }

  return {
    document,
    documentHash: sha256Hex(stableStringify(document)),
  }
}
