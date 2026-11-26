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
  pageGroups: {},
  pageTotal: null,
  statsRequestId: 0,
  pageLoading: true,
  pageError: null,
  pageLoaded: false,
  dialogLoading: false,
  dialogError: null,
  dialogRequestId: 0,
  pendingShareIds: [],
  ...createShareReaders(set, get, api),
  ...createManagementReaders(set, get, api),
  ...createShareMutations(set, get, api),
})
