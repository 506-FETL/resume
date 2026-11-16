export interface SourceOperation {
  busy: boolean
  error: string | null
  perform: (action: () => Promise<void>) => Promise<void>
}
