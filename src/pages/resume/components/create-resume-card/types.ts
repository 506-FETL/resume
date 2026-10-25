import type { ORDERType } from '@/lib/schema'

export type CreationStep =
  | 'choose'
  | 'profile'
  | 'import'
  | 'review'
  | 'template'
  | 'job'

export interface ReviewField {
  key: string
  label: string
  kind?: 'rich' | 'duration' | 'number' | 'select'
  options?: string[]
}

export interface ReviewModule {
  section: ORDERType
  arrayKey?: string
  fields: ReviewField[]
}
