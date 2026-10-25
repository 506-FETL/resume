/** PDF 字形的兼容编码只在提取副本中规范化，正文与原文件保持不变。 */
export function normalizePdfText(text: string) {
  // U+2ED3 是简体“长”的部首字形，Unicode NFKC 没有为它提供映射。
  return text.normalize('NFKC').replace(/⻓/g, '长')
}

interface PdfTextItem {
  str: string
  transform: number[]
  width: number
  height: number
  hasEOL: boolean
}

/** PDF.js 会按字体子集拆分连续汉字；只有实际几何间隔才构成字段边界。 */
export function createPdfTextAssembler() {
  let previous: PdfTextItem | undefined
  let lineEnded = false

  return (item: PdfTextItem) => {
    if (!item.str.trim()) {
      if (item.hasEOL) lineEnded = true

      return ''
    }

    const text = normalizePdfText(item.str)
    let prefix = ''

    if (previous) {
      const height = Math.max(previous.height, item.height, 1)

      const differentLine =
        Math.abs(previous.transform[5] - item.transform[5]) >
        Math.max(2, height * 0.4)

      const gap = item.transform[4] - (previous.transform[4] + previous.width)

      if (lineEnded || differentLine) prefix = '\n'
      else if (gap > height * 0.45) prefix = '   '
      else if (gap > height * 0.15) prefix = ' '
    }

    previous = item
    lineEnded = item.hasEOL

    return `${prefix}${text}`
  }
}
