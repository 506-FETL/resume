export interface AtsPreviewStats {
  evidenceCount: number
  lineCount: number
  characterCount: number
  keywordCount: number
}

export interface AtsPreviewResult {
  plainText: string
  stats: AtsPreviewStats
  warnings: string[]
}
