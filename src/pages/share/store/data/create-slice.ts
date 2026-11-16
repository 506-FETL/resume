import type { ShareDataSlice, ShareSlice } from '../types'
import { createShareMutations } from './mutations'
import { createShareReaders } from './readers'

export const createShareDataSlice: ShareSlice<ShareDataSlice> = (
  set,
  get,
  api,
) => ({
  ownerUserId: null,
  pageRequestId: 0,
  shares: [],
  allShares: [],
  resumeMap: {},
  pageLoading: true,
  pageError: null,
  pageLoaded: false,
  resumeOptionsLoading: true,
  resumeOptionsError: null,
  resumeOptionsLoaded: false,
  resumeOptionsRequestId: 0,
  dialogLoading: false,
  dialogError: null,
  dialogRequestId: 0,
  pendingShareIds: [],
  versionOptionsByResumeId: {},
  ...createShareReaders(set, get, api),
  ...createShareMutations(set, get, api),
})
