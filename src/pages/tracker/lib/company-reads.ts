import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'
import { useEffect } from 'react'
import supabase from '@/lib/supabase/client'
import { collectPages } from '@/lib/supabase/pagination'
import {
  getTrackerAccountScope,
  onTrackerVisitEnd,
  subscribeTrackerAccountScope,
} from './account-scope'
import type {
  ApplicationStatus,
  CompanyProcessPolicy,
  JobApplication,
} from '../types'
import { getTrackerErrorMessage } from '../utils/errors'

type Member = Pick<
  JobApplication,
  'id' | 'position' | 'recruitment_batch' | 'status' | 'archived'
>

const activeStatuses: ApplicationStatus[] = [
  'applied',
  'assessment',
  'screen',
  'written',
  'interview',
]

type Facts = { process_policy: CompanyProcessPolicy; active: number }

type Result<T> = { data?: T; error?: string }

const facts = createStore(() => new Map<string, Result<Facts>>())
const members = createStore(() => new Map<string, Result<Member[]>>())
const queue = new Map<string, Result<Facts>>()

async function loadFacts() {
  const pending = new Map(queue)
  const owner = getTrackerAccountScope().userId

  queue.clear()

  const ids = [...pending.keys()]

  for (let start = 0; start < ids.length; start += 60) {
    const group = ids.slice(start, start + 60)

    const { data, error } = await supabase
      .from('tracker_companies')
      .select('id,process_policy,company(count)')
      .eq('user_id', owner!)
      .in('id', group)
      .in('company.status', activeStatuses)

    const results = new Map(facts.getState())

    for (const id of group) {
      if (results.get(id) !== pending.get(id)) continue

      const row = data?.find((row) => row.id === id)

      results.set(
        id,
        row
          ? {
              data: {
                process_policy: row.process_policy as CompanyProcessPolicy,
                active: row.company[0]?.count ?? 0,
              },
            }
          : { error: error?.message || '未找到公司档案' },
      )
    }

    facts.setState(results, true)
  }
}

function requestFacts(id: string) {
  if (facts.getState().has(id)) return

  const pending: Result<Facts> = {}
  const scheduled = queue.size > 0

  facts.setState(new Map(facts.getState()).set(id, pending), true)
  queue.set(id, pending)

  if (!scheduled) queueMicrotask(loadFacts)
}

export async function readCompanyMembers(id: string) {
  const scope = getTrackerAccountScope()

  return collectPages<Member>(async (from, to) => {
    if (scope !== getTrackerAccountScope()) throw new Error('登录状态已变更')

    const { data, error } = await supabase
      .from('company')
      .select('id,position,recruitment_batch,status,archived')
      .eq('user_id', scope.userId!)
      .eq('tracker_company_id', id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)

    if (error) throw error

    return data as Member[]
  }, 200)
}

async function requestMembers(id: string) {
  if (members.getState().has(id)) return

  const pending: Result<Member[]> = {}

  members.setState(new Map(members.getState()).set(id, pending), true)

  let result: Result<Member[]>

  try {
    result = { data: await readCompanyMembers(id) }
  } catch (error) {
    result = { error: getTrackerErrorMessage(error) }
  }

  if (members.getState().get(id) === pending)
    members.setState(new Map(members.getState()).set(id, result), true)
}

export function invalidateCompany(id: string, resource: 'facts' | 'members') {
  if (resource === 'facts') {
    const next = new Map(facts.getState())

    if (next.delete(id)) facts.setState(next, true)
  } else {
    const next = new Map(members.getState())

    if (next.delete(id)) members.setState(next, true)
  }
}

export function companyJobsChanged(
  id: string,
  before?: ApplicationStatus,
  after?: ApplicationStatus,
) {
  invalidateCompany(id, 'members')

  if (
    Boolean(before && activeStatuses.includes(before)) !==
    Boolean(after && activeStatuses.includes(after))
  )
    invalidateCompany(id, 'facts')
}

export function useCompanyFacts(id: string, enabled: boolean) {
  const resource = useStore(facts, (state) => state.get(id))

  useEffect(() => {
    if (enabled && !resource) requestFacts(id)
  }, [enabled, id, resource])

  return resource
}

export function useCompanyMembers(id: string, enabled: boolean) {
  const resource = useStore(members, (state) => state.get(id))

  useEffect(() => {
    if (enabled && !resource) requestMembers(id)
  }, [enabled, id, resource])

  return resource
}

export function clearCompanyReads() {
  queue.clear()
  facts.setState(new Map(), true)
  members.setState(new Map(), true)
}

export function acceptCompanyPolicy(id: string, policy: CompanyProcessPolicy) {
  const previous = facts.getState().get(id)

  if (previous?.data) {
    facts.setState(
      new Map(facts.getState()).set(id, {
        data: { ...previous.data, process_policy: policy },
      }),
      true,
    )
  } else {
    invalidateCompany(id, 'facts')
  }
}

onTrackerVisitEnd(clearCompanyReads)
subscribeTrackerAccountScope(clearCompanyReads)
