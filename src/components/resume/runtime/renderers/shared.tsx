/* eslint-disable react-refresh/only-export-components */
import type React from 'react'
import type { CommentAnchorDocumentNode } from '@/features/resume-comments/anchors/types.ts'
import { Element } from 'html-react-parser'
import { normalizeCommentRichTextBlock, projectCommentRichTextBlocks } from '@/features/resume-comments/anchors/projection.ts'
import { parseSanitizedHtml } from '@/lib/safe-html'
import { useResumeContext } from '../context/resume-context'
import { useRuntimeStyles } from './utils'

const COMMENT_RICH_TEXT_BLOCK_TAGS = new Set([
  'p',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
])

export function buildCommentNodeKey(
  sectionKey: string,
  entryId: string,
  fieldKey: string,
) {
  return `${sectionKey}/${entryId}/${fieldKey}`
}

export function useCommentProjectionNode(nodeKey: string): CommentAnchorDocumentNode | null {
  const { commentNodesByKey } = useResumeContext()
  return commentNodesByKey.get(nodeKey) ?? null
}

function elementHasNestedCommentBlock(element: Element): boolean {
  return element.childNodes.some((child) => {
    if (!(child instanceof Element)) {
      return false
    }
    return COMMENT_RICH_TEXT_BLOCK_TAGS.has(child.name)
      || elementHasNestedCommentBlock(child)
  })
}

function domNodeText(node: Element['childNodes'][number]): string {
  if (node.type === 'text') {
    return node.data
  }
  if (!(node instanceof Element)) {
    return ''
  }
  if (node.name === 'br') {
    return '\n'
  }
  return node.childNodes.map(domNodeText).join('')
}

export function CommentableText({
  nodeKey,
  fieldLabel,
  children,
}: {
  nodeKey: string
  fieldLabel: string
  children?: React.ReactNode
}) {
  const node = useCommentProjectionNode(nodeKey)
  const content = node?.text ?? children

  if (!content) {
    return null
  }

  if (!node) {
    return <>{content}</>
  }

  return (
    <span
      data-comment-node-key={nodeKey}
      data-comment-block-ordinal="0"
      data-comment-field-label={fieldLabel}
    >
      {node.text}
    </span>
  )
}

export function CommentableRichText({
  nodeKey,
  fieldLabel,
  html,
}: {
  nodeKey: string
  fieldLabel: string
  html: string
}) {
  const node = useCommentProjectionNode(nodeKey)
  const { font, spacing, theme } = useRuntimeStyles()

  if (!node) {
    return null
  }

  const projectedBlocks = projectCommentRichTextBlocks(html)
  let blockOrdinal = 0
  const content = parseSanitizedHtml(html, undefined, {
    replace(domNode) {
      if (
        !(domNode instanceof Element)
        || !COMMENT_RICH_TEXT_BLOCK_TAGS.has(domNode.name)
        || elementHasNestedCommentBlock(domNode)
      ) {
        return
      }

      const blockText = normalizeCommentRichTextBlock(domNode.childNodes.map(domNodeText).join(''))
      const projectedBlock = projectedBlocks[blockOrdinal]
      if (!blockText || !projectedBlock || blockText !== projectedBlock.text) {
        return
      }

      domNode.attribs['data-comment-block-ordinal'] = String(blockOrdinal)
      blockOrdinal += 1
    },
  })
  const canUseParsedContent = blockOrdinal === projectedBlocks.length
  const useContainerAsOnlyBlock = projectedBlocks.length === 1 && blockOrdinal === 0

  return (
    <div
      data-comment-node-key={nodeKey}
      data-comment-field-label={fieldLabel}
      data-comment-block-ordinal={useContainerAsOnlyBlock ? '0' : undefined}
      className="max-w-none wrap-break-word [&_blockquote]:m-0 [&_li]:my-0 [&_li>p]:m-0 [&_ol]:m-0 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:m-0 [&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-5"
      style={{
        fontSize: font.contentSize,
        lineHeight: spacing.proseLineHeight,
        color: theme.textPrimary,
      }}
    >
      {canUseParsedContent || useContainerAsOnlyBlock
        ? content
        : node.blocks.map(block => (
            <span
              key={`${block.startGraphemeOffset}-${block.endGraphemeOffset}`}
              data-comment-block-ordinal={block.ordinal}
              className="block whitespace-pre-wrap"
            >
              {projectedBlocks[block.ordinal]?.text}
            </span>
          ))}
    </div>
  )
}

export function RuntimeSection({
  title,
  sectionKey,
  children,
}: {
  title: string
  sectionKey?: string
  children: React.ReactNode
}) {
  const { font, spacing, theme } = useRuntimeStyles()

  return (
    <section id={sectionKey ? `resume-section-${sectionKey}` : undefined}>
      <h2
        className="m-0 border-b-2"
        style={{
          fontSize: font.sectionTitleSize,
          fontWeight: font.boldWeight,
          color: theme.primaryColor,
          marginBottom: spacing.sectionTitleMargin,
          paddingBottom: `calc(${spacing.itemSpacing} / 2)`,
          borderColor: theme.primaryColor,
        }}
      >
        {title}
      </h2>
      <div className="flex flex-col" style={{ gap: spacing.entrySpacing }}>
        {children}
      </div>
    </section>
  )
}

export function RuntimeEntry({
  sectionKey,
  entryId,
  titleFieldKey,
  titleFieldLabel,
  subtitleFieldKey,
  subtitleFieldLabel,
  durationFieldLabel = '时间',
  contentFieldLabel = '描述',
  contentHtml,
}: {
  sectionKey: string
  entryId: string
  titleFieldKey: string
  titleFieldLabel: string
  subtitleFieldKey?: string
  subtitleFieldLabel?: string
  durationFieldLabel?: string
  contentFieldLabel?: string
  contentHtml?: string
}) {
  const { font, theme, spacing } = useRuntimeStyles()
  const titleNodeKey = buildCommentNodeKey(sectionKey, entryId, titleFieldKey)
  const subtitleNodeKey = subtitleFieldKey
    ? buildCommentNodeKey(sectionKey, entryId, subtitleFieldKey)
    : ''
  const durationNodeKey = buildCommentNodeKey(sectionKey, entryId, 'duration')
  const contentNodeKey = buildCommentNodeKey(sectionKey, entryId, 'content')
  const title = useCommentProjectionNode(titleNodeKey)
  const subtitle = useCommentProjectionNode(subtitleNodeKey)
  const duration = useCommentProjectionNode(durationNodeKey)
  const content = useCommentProjectionNode(contentNodeKey)

  if (!title && !subtitle && !duration && !content) {
    return null
  }

  return (
    <div
      className="flex flex-col"
      style={{
        gap: spacing.paragraphSpacing,
        lineHeight: spacing.lineHeight,
      }}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-wrap items-baseline gap-2 flex-1">
          <h3
            className="m-0"
            style={{
              fontSize: font.contentSize,
              fontWeight: font.boldWeight,
              color: theme.textPrimary,
            }}
          >
            <CommentableText nodeKey={titleNodeKey} fieldLabel={titleFieldLabel} />
          </h3>
          {subtitle
            ? (
                <span
                  style={{
                    fontSize: font.contentSize,
                    fontWeight: font.mediumWeight,
                    color: theme.textSecondary,
                  }}
                >
                  <CommentableText
                    nodeKey={subtitleNodeKey}
                    fieldLabel={subtitleFieldLabel ?? '副标题'}
                  />
                </span>
              )
            : null}
        </div>
        {duration
          ? (
              <span
                className="whitespace-nowrap"
                style={{
                  fontSize: font.smallSize,
                  color: theme.textMuted,
                }}
              >
                <CommentableText nodeKey={durationNodeKey} fieldLabel={durationFieldLabel} />
              </span>
            )
          : null}
      </div>
      {content && contentHtml
        ? (
            <CommentableRichText
              nodeKey={contentNodeKey}
              fieldLabel={contentFieldLabel}
              html={contentHtml}
            />
          )
        : null}
    </div>
  )
}

export function RuntimeRichText({ html }: { html: string }) {
  const { font, spacing, theme } = useRuntimeStyles()

  return (
    <div
      className="max-w-none wrap-break-word [&_blockquote]:m-0 [&_li]:my-0 [&_li>p]:m-0 [&_ol]:m-0 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:m-0 [&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-5"
      style={{
        fontSize: font.contentSize,
        lineHeight: spacing.proseLineHeight,
        color: theme.textPrimary,
      }}
    >
      {parseSanitizedHtml(html)}
    </div>
  )
}
