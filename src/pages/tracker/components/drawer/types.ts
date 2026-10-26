import type {
  ORDERType,
  PersistedResumeSnapshot,
  ResumeSchema,
  ResumeTemplateBinding,
  ResumeType,
  VisibilityFormType,
} from '@/lib/schema'

export interface ResumeOption {
  id: string
  resume_id: string
  display_name: string
  type: string
}

export type ResumePreviewData = Partial<ResumeSchema> &
  Pick<Partial<PersistedResumeSnapshot>, 'spacing' | 'font' | 'theme'> & {
    type?: ResumeType
    template_binding?: ResumeTemplateBinding
    order?: ORDERType[]
    visibility?: Partial<VisibilityFormType> | Record<string, boolean>
  }
