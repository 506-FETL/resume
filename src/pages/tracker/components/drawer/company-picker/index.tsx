import type { TrackerCompany } from '../../../types'
import { useEffect } from 'react'
import { AnimatePresence } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useShallow } from 'zustand/react/shallow'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AnimatedContent } from '@/components/motion/animated-content'
import { PresenceDiv } from '@/components/motion/presence-item'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { DURATION, EASE } from '@/lib/motion'
import useTrackerStore from '../../../store'
import { selectTrackerListJobs } from '../../../store/selectors'

export function CompanyPicker({
  id,
  value,
  name = '',
  onChange,
  allowCreate = false,
  allLabel,
  disabled = false,
}: {
  id: string
  value: string | null
  name?: string
  onChange: (id: string | null, name: string) => void
  allowCreate?: boolean
  allLabel?: string
  disabled?: boolean
}) {
  const { companies, companiesLoading, companiesError, loadCompanies, jobs } =
    useTrackerStore(
      useShallow((state) => ({
        companies: state.companies,
        companiesLoading: state.companiesLoading,
        companiesError: state.companiesError,
        loadCompanies: state.loadCompanies,
        jobs: selectTrackerListJobs(state),
      })),
    )

  const reduce = useReducedMotion()
  const selected = companies.find((company) => company.id === value) ?? null

  useEffect(() => {
    loadCompanies()
  }, [loadCompanies])

  return (
    <div className='flex min-w-0 flex-col gap-2'>
      <Combobox
        items={companies}
        value={selected}
        itemToStringLabel={(company: TrackerCompany) => company.name}
        itemToStringValue={(company: TrackerCompany) => company.id}
        isItemEqualToValue={(left: TrackerCompany, right: TrackerCompany) =>
          left.id === right.id
        }
        onValueChange={(company) =>
          onChange(company?.id ?? null, company?.name ?? '')
        }
        disabled={disabled}
      >
        <ComboboxInput
          id={id}
          placeholder={allLabel ?? '搜索并选择已有公司'}
          showClear={Boolean(allLabel)}
          disabled={disabled}
        />
        <ComboboxContent
          style={{
            animationDuration: `${reduce ? 0 : DURATION.base}s`,
            animationTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
          }}
        >
          <ComboboxEmpty>
            {companiesLoading
              ? '正在加载公司…'
              : companiesError
                ? '公司加载失败，请重试'
                : '没有匹配的公司'}
          </ComboboxEmpty>
          <ComboboxList>
            {(company: TrackerCompany) => (
              <ComboboxItem key={company.id} value={company}>
                <span className='min-w-0 truncate'>{company.name}</span>
                {companies.some(
                  (row) => row.id !== company.id && row.name === company.name,
                ) && (
                  <span className='shrink-0 text-xs text-muted-foreground'>
                    {jobs.find((job) => job.tracker_company_id === company.id)
                      ?.position ?? `暂无岗位 · ${company.id.slice(0, 6)}`}
                  </span>
                )}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <AnimatePresence initial={false}>
        {companiesLoading && (
          <PresenceDiv
            key='loading'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : DURATION.fast }}
          >
            <p className='flex items-center gap-1.5 text-xs text-muted-foreground'>
              <Spinner className='size-3' />
              正在加载公司
            </p>
          </PresenceDiv>
        )}
        {companiesError && (
          <PresenceDiv
            key='error'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : DURATION.fast }}
          >
            <Alert variant='destructive'>
              <AlertDescription className='flex flex-wrap items-center gap-2'>
                <span>{companiesError}</span>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    document.getElementById(id)?.focus()
                    loadCompanies(true)
                  }}
                >
                  重试
                </Button>
              </AlertDescription>
            </Alert>
          </PresenceDiv>
        )}
      </AnimatePresence>
      {allowCreate && (
        <AnimatedContent
          animationKey={value === null ? 'new-company' : 'existing-company'}
        >
          {value === null ? (
            <div className='space-y-1.5'>
              <Input
                id={`${id}-new`}
                aria-label='新公司名称'
                placeholder='新建公司：填写公司名称'
                value={name}
                disabled={disabled}
                onChange={(event) => onChange(null, event.target.value)}
              />
              <p className='text-xs text-muted-foreground'>
                填写名称将新建独立公司；已有公司请从上方选择，同名公司不会自动合并。
              </p>
            </div>
          ) : (
            <Button
              type='button'
              variant='link'
              size='sm'
              className='h-auto px-0'
              disabled={disabled}
              onClick={() => {
                document.getElementById(id)?.focus()
                onChange(null, '')
              }}
            >
              改为新建公司
            </Button>
          )}
        </AnimatedContent>
      )}
    </div>
  )
}
