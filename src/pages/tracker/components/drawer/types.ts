import type {
  ORDERType,
  PersistedResumeSnapshot,
  ResumeSchema,
  ResumeTemplateBinding,
  ResumeType,
  VisibilityFormType,
} from '@/lib/schema'

export type ResumePreviewData = Partial<ResumeSchema> &
  Pick<Partial<PersistedResumeSnapshot>, 'spacing' | 'font' | 'theme'> & {
    display_name?: string
    type?: ResumeType
    template_binding?: ResumeTemplateBinding
    order?: ORDERType[]
    visibility?: Partial<VisibilityFormType> | Record<string, boolean>
  }
