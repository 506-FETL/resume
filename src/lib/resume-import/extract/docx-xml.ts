import { ResumeImportError } from '../types'

export function docxXmlToText(chunks: Uint8Array[]): string[] {
  const xmlBytes = new Uint8Array(
    chunks.reduce((size, chunk) => size + chunk.length, 0),
  )

  let position = 0

  for (const chunk of chunks) {
    xmlBytes.set(chunk, position)
    position += chunk.length
  }

  const xml = new TextDecoder('utf-8', { fatal: true }).decode(xmlBytes)

  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new ResumeImportError(
      'corrupt',
      'DOCX 包含不支持的 XML 声明，请重新保存后再导入。',
    )

  const document = new DOMParser().parseFromString(xml, 'application/xml')

  if (document.querySelector('parsererror'))
    throw new ResumeImportError(
      'corrupt',
      'DOCX 正文格式错误，请重新保存后再导入。',
    )

  const paragraphs = Array.from(document.getElementsByTagNameNS('*', 'p')).map(
    (paragraph) => {
      const text: string[] = []

      const walker = document.createTreeWalker(
        paragraph,
        NodeFilter.SHOW_ELEMENT,
      )

      while (walker.nextNode()) {
        const element = walker.currentNode as Element
        let owner = element.parentElement

        while (owner && owner.localName !== 'p') owner = owner.parentElement

        if (owner !== paragraph) continue

        if (element.localName === 't') text.push(element.textContent ?? '')
        else if (element.localName === 'tab') text.push('\t')
        else if (element.localName === 'br' || element.localName === 'cr')
          text.push('\n')
      }

      return text.join('')
    },
  )

  return paragraphs
}
