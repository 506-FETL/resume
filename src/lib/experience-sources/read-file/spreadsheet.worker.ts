import { fileTypeFromBuffer } from 'file-type'
import { read, utils } from 'xlsx'
import type { CellObject } from 'xlsx'
import { decodeText } from './shared'

self.onmessage = async (
  event: MessageEvent<{ data: ArrayBuffer; extension: string }>,
) => {
  const { data, extension } = event.data

  try {
    if (extension !== 'csv') {
      const detected = await fileTypeFromBuffer(data)
      const expected = extension === 'xlsx' ? ['xlsx', 'cfb'] : ['xls', 'cfb']

      if (!detected || !expected.includes(detected.ext))
        throw new Error('表格格式与文件名不符，或文件已损坏。')
    }

    const input = extension === 'csv' ? decodeText(data) : data

    if (typeof input === 'string' && input.includes('\0'))
      throw new Error('CSV 包含二进制内容，无法作为表格读取。')

    const workbook = read(input, {
      type: typeof input === 'string' ? 'string' : 'array',
      cellHTML: false,
      cellFormula: false,
      bookVBA: false,
    })

    const sheets = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name]

      const cells = Object.entries(sheet)
        .filter(
          ([address, cell]) =>
            !address.startsWith('!') && (cell as CellObject).v != null,
        )
        .map(([address, cell]) => ({
          address,
          position: utils.decode_cell(address),
          text: utils.format_cell(cell as CellObject),
        }))
        .filter((cell) => cell.text.trim())
        .sort(
          (left, right) =>
            left.position.r - right.position.r ||
            left.position.c - right.position.c,
        )

      const lines: string[] = []
      let row = -1

      for (const cell of cells) {
        const content = `${cell.address}: ${cell.text}`

        if (cell.position.r === row) lines[lines.length - 1] += `\t${content}`
        else lines.push(content)

        row = cell.position.r
      }

      return { name, text: lines.join('\n') }
    })

    const text = sheets.some((sheet) => sheet.text)
      ? sheets
          .map((sheet) => `工作表：${sheet.name}\n${sheet.text}`)
          .join('\n\n')
      : ''

    self.postMessage({ text })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''

    self.postMessage({
      error: /password|encrypt/i.test(message)
        ? '表格受密码保护，暂时无法读取。请解除密码保护后再读取。'
        : /[\u3400-\u9fff]/.test(message)
          ? message
          : '表格已损坏或无法解析，未能读取文字。',
    })
  }
}
