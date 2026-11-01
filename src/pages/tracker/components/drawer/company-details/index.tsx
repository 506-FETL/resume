import type { CompanyProcessPolicy, JobApplication } from '../../../types'
import { Building2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AnimatedContent } from '@/components/motion/animated-content'
import { PresenceDiv } from '@/components/motion/presence-item'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { DURATION, EASE } from '@/lib/motion'
import { TrackerProcessError } from '@/lib/supabase/resume/tracker-companies'
import { APPLICATION_STATUS_CONFIG } from '../../../const'
import { isTrackerAccountScopeError } from '../../../lib/account-scope'
import useTrackerStore from '../../../store'
import { getTrackerErrorMessage } from '../../../utils'
import { COMPANY_POLICY_LABELS } from '../../../store/companies'

export function CompanyDetails({ job }: { job: JobApplication }) {
  const {
    companies,
    companiesLoading,
    companiesError,
    loadCompanies,
    updateCompanyPolicy,
    jobs,
    openJobDrawer,
  } = useTrackerStore(
    useShallow((state) => ({
      companies: state.companies,
      companiesLoading: state.companiesLoading,
      companiesError: state.companiesError,
      loadCompanies: state.loadCompanies,
      updateCompanyPolicy: state.updateCompanyPolicy,
      jobs: state.jobs,
      openJobDrawer: state.openJobDrawer,
    })),
  )

  const company = companies.find((row) => row.id === job.tracker_company_id)

  const companyJobs = jobs.filter(
    (row) => row.tracker_company_id === job.tracker_company_id,
  )

  const activeCount = companyJobs.filter((row) =>
    ['applied', 'assessment', 'screen', 'written', 'interview'].includes(
      row.status,
    ),
  ).length

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const nextJobRef = useRef<JobApplication | null>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (open) loadCompanies()
  }, [open, loadCompanies])

  const changePolicy = async (policy: CompanyProcessPolicy) => {
    if (!company) return

    setSaving(true)
    setError(null)

    try {
      await updateCompanyPolicy(company.id, policy)
      toast.success('公司规则已更新')
    } catch (nextError) {
      if (!isTrackerAccountScopeError(nextError)) setError(nextError)
    } finally {
      setSaving(false)
    }
  }

  const conflict =
    error instanceof TrackerProcessError
      ? jobs.find((row) => row.id === error.conflictJobId)
      : null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='ghost' size='sm' className='h-6 px-1 text-xs'>
          <Building2 className='size-3.5' />
          公司与关联岗位
        </Button>
      </DialogTrigger>
      <DialogContent
        className='flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-lg'
        style={{ animationDuration: `${reduce ? 0 : DURATION.base}s` }}
        onCloseAutoFocus={(event) => {
          const nextJob = nextJobRef.current

          if (!nextJob) return

          event.preventDefault()
          nextJobRef.current = null
          openJobDrawer(nextJob)
        }}
      >
        <DialogHeader className='shrink-0 pr-7'>
          <DialogTitle className='pr-6 break-words'>
            {company?.name ?? job.company}
          </DialogTitle>
          <DialogDescription>
            管理公司规则，查看同公司下的岗位流程。
          </DialogDescription>
        </DialogHeader>
        <div className='scrollbar-thin-subtle -mx-1 min-h-0 space-y-4 overflow-y-auto px-1'>
          <AnimatedContent
            animationKey={
              company
                ? 'ready'
                : companiesLoading
                  ? 'loading'
                  : companiesError
                    ? 'error'
                    : 'missing'
            }
            className='space-y-4'
          >
            {companiesLoading && !company && (
              <p className='flex items-center gap-2 text-sm text-muted-foreground'>
                <Spinner />
                正在加载公司信息
              </p>
            )}
            {companiesError && (
              <Alert variant='destructive'>
                <AlertDescription>
                  <p>{companiesError}</p>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => loadCompanies(true)}
                  >
                    重试
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {company && (
              <Field>
                <FieldLabel htmlFor='company-policy'>
                  同时进行的岗位流程
                </FieldLabel>
                <Select
                  value={company.process_policy}
                  disabled={saving}
                  onValueChange={(value) =>
                    changePolicy(value as CompanyProcessPolicy)
                  }
                >
                  <SelectTrigger id='company-policy' className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COMPANY_POLICY_LABELS).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                <p className='text-xs text-muted-foreground'>
                  当前 {activeCount}{' '}
                  个进行中，包含归档岗位。已保存、已录用和已结束不占名额。
                </p>
              </Field>
            )}
            {!companiesLoading && !companiesError && !company && (
              <div className='space-y-2'>
                <p role='status' className='text-sm text-muted-foreground'>
                  未找到公司档案。
                </p>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => loadCompanies(true)}
                >
                  重新加载
                </Button>
              </div>
            )}
          </AnimatedContent>
          <AnimatePresence initial={false}>
            {error !== null && (
              <PresenceDiv
                initial={{ opacity: 0, y: reduce ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: reduce ? 0 : DURATION.base,
                  ease: EASE.out,
                }}
              >
                <Alert variant='destructive'>
                  <AlertDescription>
                    <p>{getTrackerErrorMessage(error)}</p>
                    {conflict && (
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => {
                          setOpen(false)
                          nextJobRef.current = conflict
                        }}
                      >
                        打开冲突岗位
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              </PresenceDiv>
            )}
          </AnimatePresence>
          <div className='space-y-2'>
            <h3 className='text-sm font-semibold'>
              同公司岗位 · {companyJobs.length}
            </h3>
            {companyJobs.map((row) => (
              <Button
                key={row.id}
                variant={row.id === job.id ? 'secondary' : 'outline'}
                className='h-auto w-full justify-between gap-3 py-2.5 text-left'
                onClick={() => {
                  setOpen(false)

                  if (row.id !== job.id) nextJobRef.current = row
                }}
              >
                <span className='min-w-0'>
                  <span className='block whitespace-normal break-words'>
                    {row.position}
                  </span>
                  {row.recruitment_batch && (
                    <span className='block text-xs font-normal text-muted-foreground'>
                      {row.recruitment_batch}
                    </span>
                  )}
                </span>
                <span className='flex shrink-0 items-center gap-1.5'>
                  <Badge variant='secondary'>
                    {APPLICATION_STATUS_CONFIG[row.status].label}
                  </Badge>
                  {row.archived && (
                    <span className='text-xs text-muted-foreground'>
                      已归档
                    </span>
                  )}
                </span>
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
