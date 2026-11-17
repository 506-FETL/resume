import { read, utils } from 'xlsx'
import { fileTypeFromBuffer } from 'file-type'
import type { WorkBook, WorkSheet } from 'xlsx'
import type { SpreadsheetCommand, SpreadsheetPage } from './spreadsheet-types'

const PAGE_ROWS = 100
const MAX_CELLS = 100000
let workbook: WorkBook

self.onmessage = async (
  event: MessageEvent<SpreadsheetCommand & { id: number }>,
) => {
  const command = event.data

  try {
    let value: string[] | SpreadsheetPage

    if (command.action === 'open') {
      if (command.extension !== 'csv') {
        const detected = await fileTypeFromBuffer(command.data)

        const expected =
          command.extension === 'xlsx' ? ['xlsx'] : ['xls', 'cfb']

        if (!detected || !expected.includes(detected.ext))
          throw new Error('表格格式与文件名不符，请选择完整的 Excel 文件。')
      }

      const input =
        command.extension === 'csv'
          ? new TextDecoder('utf-8', { fatal: true }).decode(command.data)
          : command.data

      workbook = read(input, {
        type: typeof input === 'string' ? 'string' : 'array',
        cellHTML: false,
        cellFormula: false,
        bookVBA: false,
      })

      if (!workbook.SheetNames.length)
        throw new Error('文件中没有可读取的工作表。')

      let cells = 0

      for (const name of workbook.SheetNames) {
        const ref = workbook.Sheets[name]['!ref']

        if (!ref) continue

        const range = utils.decode_range(ref)

        cells += (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1)

        if (cells > MAX_CELLS)
          throw new Error('表格范围较大，暂时无法在线预览，请下载原件查看。')
      }

      value = workbook.SheetNames
    } else {
      const sheet = workbook.Sheets[command.sheet]

      if (!sheet['!ref']) {
        value = { html: '', page: 0, pages: 1, range: '' }
      } else {
        const range = utils.decode_range(sheet['!ref'])
        const pages = Math.ceil((range.e.r - range.s.r + 1) / PAGE_ROWS)
        const page = Math.min(command.page, pages - 1)
        const start = range.s.r + page * PAGE_ROWS
        const end = Math.min(start + PAGE_ROWS - 1, range.e.r)

        const ref = utils.encode_range({
          s: { r: start, c: range.s.c },
          e: { r: end, c: range.e.c },
        })

        const slice: WorkSheet = { ...sheet, '!ref': ref }

        // 合并单元格可跨越分页边界，后续页继续展示其左上角的已保存值。
        slice['!merges'] = sheet['!merges']
          ?.filter((merge) => merge.e.r >= start && merge.s.r <= end)
          .map((merge) => {
            const clipped = {
              s: { ...merge.s, r: Math.max(start, merge.s.r) },
              e: { ...merge.e, r: Math.min(end, merge.e.r) },
            }

            if (merge.s.r < start)
              slice[utils.encode_cell(clipped.s)] =
                sheet[utils.encode_cell(merge.s)]

            return clipped
          })

        value = {
          html: utils.sheet_to_html(slice, { header: '', footer: '' }),
          page,
          pages,
          range: ref,
        }
      }
    }

    self.postMessage({ id: command.id, value })
  } catch (error) {
    self.postMessage({
      id: command.id,
      error:
        error instanceof Error
          ? error.message
          : '表格无法读取，请选择未加密的完整文件。',
    })
  }
}
