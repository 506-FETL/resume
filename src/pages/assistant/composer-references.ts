export interface ComposerReference {
  token: string
  label: string
}

/** 只识别助手生成的连续前缀；正文中相似的文字保持原样。 */
export function parseComposerDraft(draft: string) {
  const references: ComposerReference[] = []
  let text = draft

  while (text) {
    const resume = /^【参考简历：([^\n]+?)\(resumeId=([\w-]+)\)】/.exec(text)
    const job = /^【参考职位：([^\n】]+)】/.exec(text)
    const match = resume ?? job

    if (!match) break

    references.push({
      token: match[0],
      label: `${resume ? '简历' : '职位'}：${match[1]}`,
    })

    text = text.slice(match[0].length).replace(/^ /, '')
  }

  return { text, references }
}

export function composeDraft(text: string, references: ComposerReference[]) {
  const prefix = references.map((reference) => reference.token).join(' ')

  return prefix ? `${prefix}${text ? ` ${text}` : ''}` : text
}

export function readableMessageText(text: string) {
  const draft = parseComposerDraft(text)
  const labels = draft.references.map((reference) => reference.label)

  return [...labels, draft.text].filter(Boolean).join('\n')
}

export function readableConversationTitle(title: string) {
  const draft = parseComposerDraft(title)

  if (draft.references.length > 0) {
    return draft.text.trim() || draft.references[0].label
  }

  // 历史标题可能在内部标识处被截断，只适配这个确切的旧格式。
  const truncated = /^【参考简历：([^\n]+?)\(resumeId=[\w-]*$/.exec(title)

  return truncated ? `简历：${truncated[1]}` : title
}
