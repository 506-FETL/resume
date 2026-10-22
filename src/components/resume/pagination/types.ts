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
  viewportWidth: number
  viewportHeight: number
  geometry: string
  fontFamily: string
  regions: Array<{
    id: string
    left: number
    top: number
    width: number
    height: number
    contentHeight: number
    geometry: string
    fontFamily: string
  }>
  pages: Array<{
    startKey: string
    endKey: string
    regions: Array<{ id: string } & PageSegment>
  }>
}

export interface RegionPaginationSnapshot {
  id: string
  segments: PageSegment[]
}

export interface PaginationSnapshot {
  segments: PageSegment[]
  regions: RegionPaginationSnapshot[]
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
