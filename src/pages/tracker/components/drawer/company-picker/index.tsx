import type { TrackerCompanyOption } from '@/lib/supabase/resume/tracker-companies'
import { useEffect, useMemo, useState } from 'react'
import { Combobox as BaseCombobox } from '@base-ui/react/combobox'
import { AnimatePresence } from 'motion/react'
import { RotateCcw } from 'lucide-react'
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
import { InputGroupAddon, InputGroupButton } from '@/components/ui/input-group'
import { useDelayedBusy } from '@/hooks/use-delayed-busy'
import { Spinner } from '@/components/ui/spinner'
import { DURATION, EASE } from '@/lib/motion'
import useTrackerStore from '../../../store'

export function CompanyPicker({
  id,
  value,
  name = '',
  onChange,
  allowCreate = false,
  allLabel,
  disabled = false,
  inputClassName,
  feedbackPlacement = 'below',
}: {
  id: string
  value: string | null
  name?: string
  onChange: (id: string | null, name: string) => void
  allowCreate?: boolean
  allLabel?: string
  disabled?: boolean
  inputClassName?: string
  feedbackPlacement?: 'below' | 'inline'
}) {
  const {
    companies,
    companiesLoading,
    companiesError,
    loadCompanies,
    complete,
    initialized,
    boundName,
    nextName,
    hints,
    loadHints,
  } = useTrackerStore(
    useShallow((state) => ({
      companies: state.companies,
      companiesLoading: state.companiesLoading,
      companiesError: state.companiesError,
      loadCompanies: state.loadCompanies,
      initialized: state.companiesInitialized,
      complete: state.companyOptionsComplete,
      nextName: state.companyNextName,
      hints: state.companyHints,
      loadHints: state.loadCompanyHints,
      boundName: value
        ? state.jobs.find((job) => job.tracker_company_id === value)?.company
        : '',
    })),
  )

  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(30)
  const { contains } = BaseCombobox.useFilter({ multiple: true })

  const matches = useMemo(
    () =>
      query
        ? companies.filter((company) => contains(company.name, query))
        : companies,
    [companies, query, contains],
  )

  const shown = useMemo(() => matches.slice(0, limit), [matches, limit])
  const more = matches.length > limit || !complete

  const nextPage = () => {
    if (more && shown.length === limit) setLimit(limit + 30)
  }

  const selected = useMemo(() => {
    if (!value) return null

    return (
      companies.find((company) => company.id === value) ?? {
        id: value,
        name: name || boundName || '',
      }
    )
  }, [value, companies, name, boundName])

  const duplicates = useMemo(() => {
    const names = new Set<string>()
    const repeated = new Set<string>()

    for (const company of companies) {
      if (names.has(company.name)) repeated.add(company.name)

      names.add(company.name)
    }

    if (nextName && names.has(nextName)) repeated.add(nextName)

    return repeated
  }, [companies, nextName])

  const sameNames = useMemo(
    () =>
      shown
        .filter((company) => duplicates.has(company.name))
        .map((company) => company.id),
    [shown, duplicates],
  )

  useEffect(() => {
    if (open) loadHints(sameNames)
  }, [open, sameNames, loadHints])

  const inlineFeedback = feedbackPlacement === 'inline'
  const showLoading = useDelayedBusy(companiesLoading)

  const feedbackState = showLoading
    ? 'loading'
    : companiesError
      ? 'error'
      : 'ready'

  useEffect(() => {
    if (
      open &&
      !complete &&
      !companiesLoading &&
      !companiesError &&
      matches.length < limit
    )
      loadCompanies()
  }, [
    open,
    complete,
    companiesLoading,
    companiesError,
    matches.length,
    limit,
    loadCompanies,
  ])

  return (
    <div className='flex min-w-0 flex-col gap-2'>
      <Combobox
        items={companies}
        filteredItems={shown}
        onOpenChange={(next) => {
          setOpen(next)

          if (!next) {
            setQuery('')
            setLimit(30)
          }
        }}
        onInputValueChange={(input, details) => {
          if (
            details.reason === 'input-change' ||
            details.reason === 'clear-press'
          ) {
            setQuery(input)
            setLimit(30)
          }
        }}
        onItemHighlighted={(_, details) => {
          if (details.index === shown.length - 1) nextPage()
        }}
        value={selected}
        itemToStringLabel={(company: TrackerCompanyOption) => company.name}
        itemToStringValue={(company: TrackerCompanyOption) => company.id}
        isItemEqualToValue={(
          left: TrackerCompanyOption,
          right: TrackerCompanyOption,
        ) => left.id === right.id}
        onValueChange={(company) =>
          onChange(company?.id ?? null, company?.name ?? '')
        }
        disabled={disabled}
      >
        <ComboboxInput
          id={id}
          className={inputClassName}
          placeholder={
            inlineFeedback && companiesError && !companiesLoading
              ? '公司加载失败'
              : (allLabel ?? '搜索并选择已有公司')
          }
          showClear={Boolean(allLabel)}
          disabled={disabled}
          aria-busy={
            open && (companiesLoading || (!initialized && !companiesError))
          }
          aria-invalid={inlineFeedback && Boolean(companiesError)}
          aria-describedby={`${id}-status`}
        >
          <InputGroupAddon
            align='inline-end'
            className='order-none w-6 shrink-0 justify-center p-0'
          >
            <AnimatedContent
              animationKey={feedbackState}
              className='flex size-6 items-center justify-center'
            >
              {showLoading ? (
                <Spinner aria-hidden className='size-3.5' />
              ) : companiesError && inlineFeedback ? (
                <InputGroupButton
                  size='icon-xs'
                  aria-label='重新加载公司'
                  className='text-destructive hover:text-destructive'
                  disabled={disabled}
                  onClick={() => {
                    document.getElementById(id)?.focus()
                    loadCompanies()
                  }}
                >
                  <RotateCcw className='size-3.5' aria-hidden />
                </InputGroupButton>
              ) : null}
            </AnimatedContent>
          </InputGroupAddon>
        </ComboboxInput>
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
          <ComboboxList
            onScroll={(event) => {
              const list = event.currentTarget

              if (
                !complete &&
                !companiesError &&
                list.scrollTop + list.clientHeight >= list.scrollHeight - 24
              )
                nextPage()
            }}
          >
            {(company: TrackerCompanyOption) => (
              <ComboboxItem key={company.id} value={company}>
                <span className='min-w-0 truncate'>{company.name}</span>
                {duplicates.has(company.name) && (
                  <span className='shrink-0 text-xs text-muted-foreground'>
                    {hints[company.id] ??
                      `${hints[company.id] === null ? '暂无岗位' : '公司编号'} · ${company.id.slice(0, 6)}`}
                  </span>
                )}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <span id={`${id}-status`} role='status' className='sr-only'>
        {companiesLoading
          ? '正在加载公司'
          : companiesError
            ? `公司加载失败：${companiesError}，请重试`
            : ''}
      </span>
      <AnimatePresence initial={false}>
        {!inlineFeedback && companiesError && (
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
                    loadCompanies()
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
