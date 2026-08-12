import type { ShareResumeSummary } from '../../types'
import type { CreateShareOptions } from '@/lib/supabase/resume/share.types'
import { Check, ChevronsUpDown, Loader2, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { dateToExpiryIso } from '../../utils'
import AnimatedVisibilityIcon from '../animated-visibility-icon'
import ShareDateField from '../share-dialog/share-date-field'

interface ShareCreateDialogProps {
  open: boolean
  resumes: ShareResumeSummary[]
  onOpenChange: (open: boolean) => void
  onCreate: (resumeId: string, options: CreateShareOptions) => Promise<void>
}

export default function ShareCreateDialog({
  open,
  resumes,
  onOpenChange,
  onCreate,
}: ShareCreateDialogProps) {
  const [resumeId, setResumeId] = useState('')
  const [resumeOpen, setResumeOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [expiresAt, setExpiresAt] = useState<Date | undefined>()
  const [submitting, setSubmitting] = useState(false)
  const selectedResume = useMemo(
    () => resumes.find(resume => resume.resumeId === resumeId) ?? null,
    [resumeId, resumes],
  )

  const reset = () => {
    setResumeId('')
    setLabel('')
    setPassword('')
    setShowPassword(false)
    setExpiresAt(undefined)
  }

  const handleCreate = async () => {
    if (!resumeId)
      return
    setSubmitting(true)
    try {
      await onCreate(resumeId, {
        label: label.trim() || null,
        password: password.trim() || null,
        expiresAt: dateToExpiryIso(expiresAt),
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
        if (!nextOpen && !submitting)
          reset()
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="min-w-0 max-w-xl overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>新建分享</DialogTitle>
          <DialogDescription>选择简历并设置链接。</DialogDescription>
        </DialogHeader>

        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0 flex flex-col gap-1.5 sm:col-span-2">
            <Label>选择简历</Label>
            <Popover open={resumeOpen} onOpenChange={setResumeOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full min-w-0 justify-between">
                  <span className="truncate">{selectedResume?.displayName ?? '搜索并选择简历'}</span>
                  <ChevronsUpDown className="opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
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
          </div>

          <div className="min-w-0 flex flex-col gap-1.5">
            <Label htmlFor="new-share-label">链接名称</Label>
            <Input
              id="new-share-label"
              value={label}
              onChange={event => setLabel(event.target.value)}
              placeholder="如：字节专用"
              maxLength={120}
            />
          </div>
          <div className="min-w-0 flex flex-col gap-1.5">
            <Label htmlFor="new-share-password">访问密码</Label>
            <div className="relative">
              <Input
                id="new-share-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="留空则无需密码"
                className="pr-10"
                maxLength={128}
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                aria-label={showPassword ? '隐藏访问密码' : '显示访问密码'}
                onClick={() => setShowPassword(value => !value)}
              >
                <AnimatedVisibilityIcon visible={showPassword} />
              </Button>
            </div>
          </div>
          <div className="min-w-0 flex flex-col gap-1.5 sm:col-span-2">
            <Label>有效期</Label>
            <ShareDateField value={expiresAt} onChange={setExpiresAt} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleCreate} disabled={!resumeId || submitting}>
            {submitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
            创建分享
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
