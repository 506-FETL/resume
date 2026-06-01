// Placeholder for Task 3. Full schema implemented in Task 3.
export type DerivedStatus = 'generating' | 'ready' | 'failed'

export interface VariantMetadata {
  keywords: string[]
  changes: unknown[]
  generatedAt: string
  matchRate: number
}
