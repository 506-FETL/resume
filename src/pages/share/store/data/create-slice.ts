import type { ShareDataSlice, ShareSlice } from '../types'
import { createShareMutations } from './mutations'
import { createManagementReaders } from './management'
import { createShareReaders } from './readers'

export const createShareDataSlice: ShareSlice<ShareDataSlice> = (
  set,
  get,
  api,
) => ({
  pageRequestId: 0,
  pageNumber: 1,
  pageQueryKey: null,
  pageKeyword: '',
  managementOpen: false,
  overview: null,
  pageStats: null,
  countScope: null,
  statusCounts: null,
  statsLoading: true,
  statsError: null,
  shares: [],
  pageShares: [],
  resumeMap: {},
  pageLoading: true,
  pageError: null,
  pageLoaded: false,
  resumeOptionsLoading: true,
  resumeOptionsError: null,
  resumeOptionsLoaded: false,
  dialogLoading: false,
  dialogError: null,
  dialogRequestId: 0,
  pendingShareIds: [],
  versionOptionsByResumeId: {},
  ...createShareReaders(set, get, api),
  ...createManagementReaders(set, get, api),
  ...createShareMutations(set, get, api),
})
