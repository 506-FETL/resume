import type { CompanyProcessPolicy } from '../types'
import {
  listTrackerCompanies,
  readCompanyPositionHints,
  type TrackerCompanyOption,
  updateTrackerCompanyPolicy,
} from '@/lib/supabase/resume/tracker-companies'
import {
  assertTrackerAccountScope,
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
} from '../lib/account-scope'
import { acceptCompanyPolicy } from '../lib/company-reads'
import { getTrackerErrorMessage } from '../utils'

export const COMPANY_POLICY_LABELS: Record<CompanyProcessPolicy, string> = {
  unknown: '规则未确认',
  single_active: '同时一个流程',
  multiple_active: '允许多个流程',
}

interface CompanyState {
  companies: TrackerCompanyOption[]
  companiesLoading: boolean
  companiesError: string | null
  companiesInitialized: boolean
  companyOptionsComplete: boolean
  companyNextName: string | null
  companyHints: Record<string, string | null>
}

export function createTrackerCompanies(
  get: () => CompanyState,
  set: (
    update:
      | Partial<CompanyState>
      | ((state: CompanyState) => Partial<CompanyState>),
  ) => void,
) {
  let pending: Promise<void> | null = null
  let revision = 0
  const pendingHints = new Set<string>()

  const loadPage = (size: number): Promise<void> => {
    const scope = getTrackerAccountScope()

    if (!scope.userId || get().companyOptionsComplete) return Promise.resolve()
    if (pending) return pending

    const token = revision
    const from = get().companies.length

    set({ companiesLoading: true, companiesError: null })

    const request = listTrackerCompanies(scope.userId, from, size)
      .then((rows) => {
        if (token !== revision || !isTrackerAccountScopeCurrent(scope)) return

        set((state) => ({
          companies: [...state.companies, ...rows.slice(0, size)],
          companiesInitialized: true,
          companyOptionsComplete: rows.length <= size,
          companyNextName: rows[size]?.name ?? null,
        }))
      })
      .catch((error) => {
        if (token === revision && isTrackerAccountScopeCurrent(scope))
          set({ companiesError: getTrackerErrorMessage(error) })
      })
      .finally(() => {
        if (pending === request) pending = null
        if (token === revision && isTrackerAccountScopeCurrent(scope))
          set({ companiesLoading: false })
      })

    pending = request

    return request
  }

  return {
    companies: [] as TrackerCompanyOption[],
    companiesLoading: false,
    companiesError: null as string | null,
    companiesInitialized: false,
    companyOptionsComplete: false,
    companyNextName: null as string | null,
    companyHints: {} as Record<string, string | null>,
    resetCompanyOptions: () => {
      revision++
      pendingHints.clear()
      pending = null

      set({
        companies: [],
        companyNextName: null,
        companyHints: {},
        companiesInitialized: false,
        companyOptionsComplete: false,
        companiesError: null,
        companiesLoading: false,
      })
    },
    loadCompanies: () => loadPage(30),
    loadCompanyHints: async (ids: string[]) => {
      const scope = getTrackerAccountScope()
      const token = revision

      const missing = ids.filter(
        (id) => !(id in get().companyHints) && !pendingHints.has(id),
      )

      if (!scope.userId || !missing.length) return

      missing.forEach((id) => pendingHints.add(id))

      try {
        const positions = await readCompanyPositionHints(scope.userId, missing)

        if (token === revision && isTrackerAccountScopeCurrent(scope))
          set((state) => ({
            companyHints: { ...state.companyHints, ...positions },
          }))
      } catch {
        // 名称与主键仍可选择；再次展开时再取同名公司的岗位提示。
      } finally {
        if (token === revision) missing.forEach((id) => pendingHints.delete(id))
      }
    },
    updateCompanyPolicy: async (id: string, policy: CompanyProcessPolicy) => {
      const scope = getTrackerAccountScope()

      assertTrackerAccountScope(scope)

      const company = await updateTrackerCompanyPolicy(id, policy)

      assertTrackerAccountScope(scope)

      acceptCompanyPolicy(id, company.process_policy)

      return company
    },
  }
}
