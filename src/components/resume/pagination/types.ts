export type PaginationStatus = 'measuring' | 'ready' | 'error'

export interface PageBoundary {
  offset: number
  key: string
}

export interface PageSegment {
  start: number
  end: number
  startKey: string
  endKey: string
}

export interface ResumeLayoutSignature {
  pageWidth: number
  pageHeight: number
  contentHeight: number
  fontFamily: string
  pages: Array<{
    startKey: string
    endKey: string
  }>
}

export interface PaginationSnapshot {
  segments: PageSegment[]
  signature: ResumeLayoutSignature
}

export interface ResumeDocumentState {
  status: PaginationStatus
  signature: ResumeLayoutSignature | null
  fontFamily: string
  fontWeights: number[]
  error: string | null
}

export type ResumeDocumentStateChange = (state: ResumeDocumentState) => void
