import type { CompanyProcessPolicy, TrackerCompany } from '../types'
import {
  listTrackerCompanies,
  updateTrackerCompanyPolicy,
} from '@/lib/supabase/resume/tracker-companies'
import {
  assertTrackerAccountScope,
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
} from '../lib/account-scope'
import { getTrackerErrorMessage } from '../utils'

export const COMPANY_POLICY_LABELS: Record<CompanyProcessPolicy, string> = {
  unknown: '规则未确认',
  single_active: '同时一个流程',
  multiple_active: '允许多个流程',
}

interface CompanyState {
  companies: TrackerCompany[]
  companiesLoading: boolean
  companiesError: string | null
  companiesInitialized: boolean
}

export function createTrackerCompanies(
  get: () => CompanyState,
  set: (
    update:
      | Partial<CompanyState>
      | ((state: CompanyState) => Partial<CompanyState>),
  ) => void,
) {
  return {
    companies: [] as TrackerCompany[],
    companiesLoading: false,
    companiesError: null as string | null,
    companiesInitialized: false,
    loadCompanies: async (force = false) => {
      const scope = getTrackerAccountScope()

      if (
        !scope.userId ||
        get().companiesLoading ||
        (get().companiesInitialized && !force)
      )
        return

      set({ companiesLoading: true, companiesError: null })

      try {
        const companies = await listTrackerCompanies()

        assertTrackerAccountScope(scope)
        set({ companies, companiesInitialized: true })
      } catch (error) {
        if (isTrackerAccountScopeCurrent(scope))
          set({ companiesError: getTrackerErrorMessage(error) })
      } finally {
        if (isTrackerAccountScopeCurrent(scope))
          set({ companiesLoading: false })
      }
    },
    updateCompanyPolicy: async (id: string, policy: CompanyProcessPolicy) => {
      const scope = getTrackerAccountScope()

      assertTrackerAccountScope(scope)

      const company = await updateTrackerCompanyPolicy(id, policy)

      assertTrackerAccountScope(scope)

      set((state) => ({
        companies: state.companies.map((row) =>
          row.id === id ? company : row,
        ),
      }))

      return company
    },
  }
}
