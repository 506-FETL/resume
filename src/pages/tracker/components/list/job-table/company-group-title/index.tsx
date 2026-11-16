import type { JobApplication } from '../../../../types'
import { useShallow } from 'zustand/react/shallow'
import { Skeleton } from '@/components/ui/skeleton'
import useTrackerStore from '../../../../store'
import { COMPANY_POLICY_LABELS } from '../../../../store/companies'

export function CompanyGroupTitle({ job }: { job: JobApplication }) {
  const { company, activeCount, companiesError, companiesLoading } =
    useTrackerStore(
      useShallow((state) => ({
        company: state.companies.find(
          (row) => row.id === job.tracker_company_id,
        ),
        activeCount: state.jobs.filter(
          (row) =>
            row.tracker_company_id === job.tracker_company_id &&
            [
              'applied',
              'assessment',
              'screen',
              'written',
              'interview',
            ].includes(row.status),
        ).length,
        companiesError: state.companiesError,
        companiesLoading: state.companiesLoading,
      })),
    )

  return (
    <div className='flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1'>
      <span className='min-w-0 break-words text-sm font-semibold'>
        {company?.name ?? job.company}
      </span>
      <span className='text-xs font-normal text-muted-foreground'>
        {activeCount} 个进行中 ·{' '}
        {company ? (
          COMPANY_POLICY_LABELS[company.process_policy]
        ) : companiesLoading ? (
          <span role='status' aria-label='正在加载公司流程规则'>
            <Skeleton className='inline-block h-3 w-16 align-middle' />
          </span>
        ) : companiesError ? (
          '规则加载失败'
        ) : (
          '规则未加载'
        )}
      </span>
    </div>
  )
}
