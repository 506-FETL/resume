import type { JobApplication } from '../../../../types'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useCompanyFacts,
  invalidateCompany,
} from '../../../../lib/company-reads'
import { Button } from '@/components/ui/button'
import { COMPANY_POLICY_LABELS } from '../../../../store/companies'

export function CompanyGroupTitle({ job }: { job: JobApplication }) {
  const facts = useCompanyFacts(job.tracker_company_id, true)

  return (
    <div className='flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1'>
      <span className='min-w-0 break-words text-sm font-semibold'>
        {job.company}
      </span>
      <span className='text-xs font-normal text-muted-foreground'>
        {facts?.data ? (
          `${facts.data.active} 个进行中 · ${COMPANY_POLICY_LABELS[facts.data.process_policy]}`
        ) : facts?.error ? (
          <Button
            variant='link'
            size='sm'
            onClick={() => invalidateCompany(job.tracker_company_id, 'facts')}
          >
            公司规则加载失败，重试
          </Button>
        ) : (
          <Skeleton
            aria-label='正在加载公司流程规则'
            className='inline-block h-3 w-20 align-middle'
          />
        )}
      </span>
    </div>
  )
}
