import type { ResumeListState } from './types'
import { create } from 'zustand'
import { createResumeListSlice } from './resume-list'
import { createResumeSyncSlice } from './resume-sync'
import { createResumeUiSlice } from './resume-ui'
import { createTemplateNamesSlice } from './template-names'

const useResumeListStore = create<ResumeListState>()((set, get) => ({
  ...createResumeListSlice(set),
  ...createResumeSyncSlice(set, get),
  ...createResumeUiSlice(set),
  ...createTemplateNamesSlice(set, get),
}))

export default useResumeListStore
export type { ResumeListState } from './types'
