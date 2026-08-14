import type { Locate, RawValue } from '../schema/ats.ts'

export interface AtsAssessmentField {
  locate: Locate
  rawValue: RawValue
  requiredWithinEntry: boolean
}

export interface AtsAssessmentItem {
  entryId: string | null
  itemLabel: string | null
  sourceIndex: number | null
  fields: AtsAssessmentField[]
}

export interface AtsAssessmentSection {
  key: string
  label: string
  items: AtsAssessmentItem[]
}

export interface AtsAssessmentScope {
  evaluatedSections: string[]
  ignoredEmptySections: string[]
  hasCandidateName: boolean
  hasContactMethod: boolean
}

export interface AtsAssessmentInput {
  rubricVersion: '2.0'
  sections: AtsAssessmentSection[]
  scope: AtsAssessmentScope
}
