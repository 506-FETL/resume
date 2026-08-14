import type { ShareVersionSelection } from '@/lib/supabase/resume/share.types'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { getResumeSnapshotById, resolveResumeShareRelease } from '@/lib/supabase/resume/share'
import { cn } from '@/lib/utils'
import useShareStore from '../../store'
import { dateToExpiryIso } from '../../utils'
import DateField from '../quick-dialog/date-field'
import VersionSelector from '../version-selector'
import VisibilityIcon from '../visibility-icon'

interface CreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function CreateDialog({
  open,
  onOpenChange,
}: CreateDialogProps) {
  const {
    resumeMap,
    createRelease,
    loadVersionOptions,
    versionOptionsByResumeId,
  } = useShareStore()
  const [resumeId, setResumeId] = useState('')
  const [resumeOpen, setResumeOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [expiresAt, setExpiresAt] = useState<Date | undefined>()
  const [allowComments, setAllowComments] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selection, setSelection] = useState<ShareVersionSelection>({ kind: 'current' })
  const resumes = useMemo(
    () => Object.values(resumeMap).sort(
      (left, right) => left.displayName.localeCompare(right.displayName),
    ),
    [resumeMap],
  )
  const selectedResume = useMemo(
    () => resumes.find(resume => resume.resumeId === resumeId) ?? null,
    [resumeId, resumes],
  )
  const versionEntry = resumeId ? versionOptionsByResumeId[resumeId] : undefined

  const reset = () => {
    setResumeId('')
    setLabel('')
    setPassword('')
    setShowPassword(false)
    setExpiresAt(undefined)
    setAllowComments(true)
    setSelection({ kind: 'current' })
  }

  const handleCreate = async () => {
    if (!resumeId)
      return
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
        allowComments,
      })
      toast.success('分享链接已生成')
      reset()
      onOpenChange(false)
    }
    catch {
      toast.error('创建失败')
    }
    finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && submitting)
          return
        if (!nextOpen)
          reset()
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="min-w-0 max-w-xl overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>新建分享</DialogTitle>
          <DialogDescription>选择简历并设置链接。</DialogDescription>
        </DialogHeader>

        <FieldGroup className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <Field className="min-w-0 sm:col-span-2">
            <FieldLabel>选择简历</FieldLabel>
            <Popover open={resumeOpen} onOpenChange={setResumeOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={resumeOpen}
                  disabled={submitting}
                  className="w-full min-w-0 justify-between"
                >
                  <span className="truncate">{selectedResume?.displayName ?? '搜索并选择简历'}</span>
                  <ChevronsUpDown data-icon="inline-end" className="opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                <Command>
                  <CommandInput placeholder="搜索简历" />
                  <CommandList>
                    <CommandEmpty>没有匹配的简历</CommandEmpty>
                    <CommandGroup>
                      {resumes.map(resume => (
                        <CommandItem
                          key={resume.resumeId}
                          value={`${resume.displayName} ${resume.resumeId}`}
                          onSelect={() => {
                            setResumeId(resume.resumeId)
                            setSelection({ kind: 'current' })
                            loadVersionOptions(resume.resumeId, { force: true }).catch(() => undefined)
                            setResumeOpen(false)
                          }}
                        >
                          <span className="min-w-0 flex-1 truncate">{resume.displayName}</span>
                          <Check className={cn('size-4', resumeId === resume.resumeId ? 'opacity-100' : 'opacity-0')} />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </Field>

          <Field className="min-w-0 sm:col-span-2">
            <FieldLabel>分享版本</FieldLabel>
            <VersionSelector
              value={selection}
              versions={versionEntry?.items ?? []}
              loading={versionEntry?.loading ?? false}
              error={versionEntry?.error ?? null}
              disabled={!resumeId || submitting}
              onChange={setSelection}
              onRetry={() => {
                if (resumeId)
                  loadVersionOptions(resumeId, { force: true }).catch(() => undefined)
              }}
            />
          </Field>

          <Field className="min-w-0">
            <FieldLabel htmlFor="new-share-label">链接名称</FieldLabel>
            <Input
              id="new-share-label"
              value={label}
              onChange={event => setLabel(event.target.value)}
              placeholder="如：字节专用"
              maxLength={120}
            />
          </Field>
          <Field className="min-w-0">
            <FieldLabel htmlFor="new-share-password">访问密码</FieldLabel>
            <div className="flex min-w-0 gap-2">
              <Input
                id="new-share-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="留空则无需密码"
                className="min-w-0"
                maxLength={128}
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={showPassword ? '隐藏访问密码' : '显示访问密码'}
                onClick={() => setShowPassword(value => !value)}
              >
                <VisibilityIcon visible={showPassword} />
              </Button>
            </div>
          </Field>
          <Field className="min-w-0 sm:col-span-2">
            <FieldLabel>有效期</FieldLabel>
            <DateField value={expiresAt} onChange={setExpiresAt} />
          </Field>
          <Field orientation="horizontal" className="min-w-0 rounded-lg border p-3 sm:col-span-2">
            <FieldLabel htmlFor="new-share-comments">允许访问者评论</FieldLabel>
            <Switch
              id="new-share-comments"
              checked={allowComments}
              disabled={submitting}
              onCheckedChange={setAllowComments}
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleCreate} disabled={!resumeId || submitting}>
            {submitting ? <Spinner data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
            创建分享
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
