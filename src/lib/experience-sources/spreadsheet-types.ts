export type SpreadsheetCommand =
  | { action: 'open'; data: ArrayBuffer; extension: string }
  | { action: 'preview'; sheet: string; page: number }

export interface SpreadsheetPage {
  html: string
  page: number
  pages: number
  range: string
}
