import { useJobContextStore } from '@/lib/job-context'
import type { SharePurpose } from '@/lib/supabase/resume/share.types'
import { sharePurposeDefaults } from '@/lib/share-purpose'
import PurposeFields from '../purpose-fields'
import type { ShareVersionSelection } from '@/lib/supabase/resume/share.types'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useLayoutEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { DURATION, EASE } from '@/lib/motion'
import {
  getResumeSnapshotById,
  resolveResumeShareRelease,
} from '@/lib/supabase/resume/share'
import { cn } from '@/lib/utils'
import useShareStore from '../../store'
import { dateToExpiryIso } from '../../utils'
import DateField from '../quick-dialog/date-field'
import VersionSelector from '../version-selector'
import VisibilityIcon from '../visibility-icon'
import ShareDrawer from '../share-drawer'

interface CreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function CreateDialog({
  open,
  onOpenChange,
}: CreateDialogProps) {
  const jobContext = useJobContextStore((state) => state.context)
  const reduceMotion = useReducedMotion()

  const {
    resumeMap,
    createRelease,
    loadVersionOptions,
    versionOptionsByResumeId,
  } = useShareStore()

  const [resumeId, setResumeId] = useState('')
  const [resumeOpen, setResumeOpen] = useState(false)
  const [purpose, setPurpose] = useState<SharePurpose>('review')
  const [showPhone, setShowPhone] = useState(true)
  const [showEmail, setShowEmail] = useState(true)

  const changePurpose = (value: SharePurpose) => {
    const defaults = sharePurposeDefaults(value)

    setPurpose(value)
    setShowPhone(defaults.showPhone)
    setShowEmail(defaults.showEmail)
    setAllowComments(defaults.allowComments)
    setSelection({ kind: 'current' })
  }

  const [label, setLabel] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [expiresAt, setExpiresAt] = useState<Date | undefined>()
  const [allowComments, setAllowComments] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [selection, setSelection] = useState<ShareVersionSelection>({
    kind: 'current',
  })

  const resumes = useMemo(
    () =>
      Object.values(resumeMap).sort((left, right) =>
        left.displayName.localeCompare(right.displayName),
      ),
    [resumeMap],
  )

  const selectedResume = useMemo(
    () => resumes.find((resume) => resume.resumeId === resumeId) ?? null,
    [resumeId, resumes],
  )

  const versionEntry = resumeId ? versionOptionsByResumeId[resumeId] : undefined

  useLayoutEffect(() => {
    if (!open) return

    setResumeId(jobContext?.resumeId ?? '')

    if (jobContext?.resumeId)
      loadVersionOptions(jobContext.resumeId, { force: true }).catch(
        () => undefined,
      )

    setResumeOpen(false)
    setLabel('')
    setPassword('')
    setShowPassword(false)
    setExpiresAt(undefined)
    changePurpose('review')
    setAllowComments(true)
    setSelection({ kind: 'current' })
  }, [open, jobContext, loadVersionOptions])

  const handleCreate = async () => {
    if (!resumeId) return

    setSubmitting(true)

    try {
      const release = await resolveResumeShareRelease({
        resumeId,
        displayName: selectedResume?.displayName ?? null,
        selection,
        getCurrentSource: getResumeSnapshotById,
      })

      await createRelease(resumeId, release, {
        label: label.trim() || null,
        password: password.trim() || null,
        expiresAt: dateToExpiryIso(expiresAt),
        purpose,
        jobId: jobContext?.resumeId === resumeId ? jobContext.id : undefined,
        showPhone,
        showEmail,
        allowComments:
          purpose === 'showcase' || !showPhone || !showEmail
            ? false
            : allowComments,
      })

      toast.success('分享链接已生成')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ShareDrawer
      open={open}
      busy={submitting}
      onOpenChange={onOpenChange}
      title='新建分享'
      description='选择一份简历，设置用途和访问权限后生成链接。'
      footer={
        <>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button onClick={handleCreate} disabled={!resumeId || submitting}>
            {submitting ? (
              <Spinner data-icon='inline-start' />
            ) : (
              <Plus data-icon='inline-start' />
            )}
            {submitting ? '正在创建…' : '创建分享'}
          </Button>
        </>
      }
    >
      <div className='space-y-6'>
        <section
          className='space-y-4'
          aria-labelledby='new-share-content-heading'
        >
          <h3 id='new-share-content-heading' className='text-sm font-medium'>
            分享内容
          </h3>
          <FieldGroup className='grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2'>
            <Field className='min-w-0 sm:col-span-2'>
              <FieldLabel>选择简历</FieldLabel>
              <Popover
                modal
                open={open && resumeOpen}
                onOpenChange={setResumeOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant='outline'
                    role='combobox'
                    aria-expanded={resumeOpen}
                    disabled={submitting}
                    className='w-full min-w-0 justify-between'
                  >
                    <span className='truncate'>
                      {selectedResume?.displayName ?? '搜索并选择简历'}
                    </span>
                    <ChevronsUpDown
                      data-icon='inline-end'
                      className='opacity-50'
                    />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  inert={!open || !resumeOpen}
                  className='w-(--radix-popover-trigger-width) p-0 data-[state=closed]:pointer-events-none'
                  align='start'
                  style={{
                    animationDuration: `${(reduceMotion ? 0 : resumeOpen ? DURATION.base : DURATION.fast) * 1000}ms`,
                    animationTimingFunction: `cubic-bezier(${(resumeOpen ? EASE.out : EASE.in).join(',')})`,
                  }}
                >
                  <Command>
                    <CommandInput placeholder='搜索简历' />
                    <CommandList className='max-h-[min(18rem,calc(var(--radix-popover-content-available-height)-3rem))] overscroll-contain'>
                      <CommandEmpty>没有匹配的简历</CommandEmpty>
                      <CommandGroup>
                        {resumes.map((resume) => (
                          <CommandItem
                            key={resume.resumeId}
                            value={`${resume.displayName} ${resume.resumeId}`}
                            onSelect={() => {
                              setResumeId(resume.resumeId)
                              setSelection({ kind: 'current' })

                              loadVersionOptions(resume.resumeId, {
                                force: true,
                              }).catch(() => undefined)

                              setResumeOpen(false)
                            }}
                          >
                            <span className='min-w-0 flex-1 truncate'>
                              {resume.displayName}
                            </span>
                            <Check
                              className={cn(
                                'size-4',
                                resumeId === resume.resumeId
                                  ? 'opacity-100'
                                  : 'opacity-0',
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </Field>

            <Field className='min-w-0 sm:col-span-2'>
              <FieldLabel>分享版本</FieldLabel>
              <VersionSelector
                value={selection}
                freezeCurrent={purpose === 'application'}
                versions={versionEntry?.items ?? []}
                loading={versionEntry?.loading ?? false}
                error={versionEntry?.error ?? null}
                disabled={
                  !open || !resumeId || submitting || purpose !== 'application'
                }
                onChange={setSelection}
                onRetry={() => {
                  if (resumeId)
                    loadVersionOptions(resumeId, { force: true }).catch(
                      () => undefined,
                    )
                }}
              />
            </Field>
          </FieldGroup>
        </section>
        <section
          className='space-y-4 border-t pt-5'
          aria-labelledby='new-share-access-heading'
        >
          <h3 id='new-share-access-heading' className='text-sm font-medium'>
            用途与隐私
          </h3>
          <PurposeFields
            purpose={purpose}
            showPhone={showPhone}
            showEmail={showEmail}
            onPurposeChange={changePurpose}
            onShowPhoneChange={setShowPhone}
            onShowEmailChange={setShowEmail}
            disabled={submitting}
          />
        </section>
        <section
          className='space-y-4 border-t pt-5'
          aria-labelledby='new-share-link-heading'
        >
          <h3 id='new-share-link-heading' className='text-sm font-medium'>
            链接设置
          </h3>
          <FieldGroup className='grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2'>
            <Field className='min-w-0'>
              <FieldLabel htmlFor='new-share-label'>链接名称</FieldLabel>
              <Input
                id='new-share-label'
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder='如：产品经理岗位投递'
                maxLength={120}
                disabled={submitting}
              />
            </Field>
            <Field className='min-w-0'>
              <FieldLabel htmlFor='new-share-password'>访问密码</FieldLabel>
              <div className='flex min-w-0 gap-2'>
                <Input
                  id='new-share-password'
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder='留空则无需密码'
                  className='min-w-0'
                  maxLength={128}
                  autoComplete='new-password'
                  disabled={submitting}
                />
                <Button
                  type='button'
                  variant='outline'
                  size='icon'
                  aria-label={showPassword ? '隐藏访问密码' : '显示访问密码'}
                  disabled={submitting}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  <VisibilityIcon visible={showPassword} />
                </Button>
              </div>
            </Field>
            <Field className='min-w-0 sm:col-span-2'>
              <FieldLabel>有效期</FieldLabel>
              <DateField
                value={expiresAt}
                onChange={setExpiresAt}
                disabled={submitting}
              />
            </Field>
            <Field
              orientation='horizontal'
              className='min-w-0 border-t pt-4 sm:col-span-2'
            >
              <FieldLabel htmlFor='new-share-comments'>
                允许访问者评论
              </FieldLabel>
              <Switch
                id='new-share-comments'
                checked={
                  purpose !== 'showcase' &&
                  showPhone &&
                  showEmail &&
                  allowComments
                }
                disabled={
                  submitting ||
                  purpose === 'showcase' ||
                  !showPhone ||
                  !showEmail
                }
                onCheckedChange={setAllowComments}
              />
            </Field>
          </FieldGroup>
        </section>
      </div>
    </ShareDrawer>
  )
}
