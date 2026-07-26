/* eslint-disable react-refresh/only-export-components */
import type { PropsWithChildren } from 'react'
import type { ORDERType, ResumeSchema, ResumeTemplateBinding, ResumeType, VisibilityFormType } from '@/lib/schema'
import { createContext, use } from 'react'
import { normalizeResumeFormData, resolveResumeTemplateBinding } from '@/lib/schema'

type VisibleSection = Exclude<ORDERType, 'basics'>

export interface TemplateResumeDataInput extends ResumeSchema {
  order: ORDERType[]
  type: ResumeType
  visibility: VisibilityFormType
  templateBinding?: ResumeTemplateBinding
}

export interface TemplateResumeData extends ResumeSchema {
  order: ORDERType[]
  type: ResumeType
  visibility: VisibilityFormType
  templateBinding?: ResumeTemplateBinding
  getVisibility: (id: VisibleSection) => boolean
}

const TemplateResumeDataContext = createContext<TemplateResumeData | null>(null)

export function buildTemplateResumeData(snapshot: TemplateResumeDataInput): TemplateResumeData {
  const formData = normalizeResumeFormData(snapshot)

  return {
    ...snapshot,
    ...formData,
    templateBinding: resolveResumeTemplateBinding(snapshot.templateBinding, snapshot.type),
    // visibility 存的是“是否隐藏”，runtime 读取时需要转换成“是否显示”
    getVisibility: id => snapshot.visibility[id] !== true,
  }
}

export function TemplateResumeDataProvider({
  children,
  value,
}: PropsWithChildren<{ value: TemplateResumeData }>) {
  return (
    <TemplateResumeDataContext value={value}>
      {children}
    </TemplateResumeDataContext>
  )
}

export function useTemplateResumeData(): TemplateResumeData {
  const context = use(TemplateResumeDataContext)
  if (!context) {
    throw new Error('useTemplateResumeData must be used within a TemplateResumeDataProvider')
  }
  return context
}
