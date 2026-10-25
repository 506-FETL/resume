/** 只生成段落与换行，原文中的 HTML 始终作为文字显示。 */
export function textToResumeHtml(text: string): string {
  if (!text.trim()) return ''

  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

  return escaped
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export function resumeHtmlToText(html: string): string {
  if (!html) return ''

  const document = new DOMParser().parseFromString(html, 'text/html')

  document
    .querySelectorAll('script,style,template')
    .forEach((node) => node.remove())

  document.querySelectorAll('br').forEach((node) => node.replaceWith('\n'))

  document.querySelectorAll('p,div,li,h1,h2,h3,h4,tr').forEach((node) => {
    node.append('\n')
  })

  return (document.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim()
}
