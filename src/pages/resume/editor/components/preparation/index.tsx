import type { ResumeProfile } from '@/lib/resume-preparation/types'
import { Lightbulb } from 'lucide-react'
import { useRef, useState } from 'react'
import type { ORDERType } from '@/lib/schema'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { toast } from 'sonner'
import { AnimatedContent } from '@/components/motion/animated-content'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { DURATION, EASE } from '@/lib/motion'
import { PROFILE_GUIDES, SECTION_LABELS } from '@/lib/resume-preparation/const'
import { collectSectionEvidence } from '@/lib/resume-preparation/evidence'
import { usePreparationRecord } from '@/lib/resume-preparation/hooks'
import { updatePreparation } from '@/lib/resume-preparation/storage'
import { textToResumeHtml } from '@/lib/resume-import/text'
import useResumeStore from '@/store/resume/form'
import useUserStore from '@/store/user'
import { useResumeReviewStore } from '../../review-store'
import { usePreparationUiStore } from '../../preparation-store'

export default function Preparation({
  isMobile = false,
}: {
  isMobile?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [contentMounted, setContentMounted] = useState(false)
  const [selected, setSelected] = useState<ResumeProfile | null>(null)
  const [busy, setBusy] = useState(false)

  const pendingEditRef = useRef<{
    resumeId: string
    section: ORDERType
  } | null>(null)

  const resumeId = useResumeStore((state) => state.currentResumeId)
  const initialized = useResumeStore((state) => state.isInitialized)
  const reviewActive = useResumeReviewStore((state) => state.active)

  const { record, loading, error, ownerId, retry } = usePreparationRecord(
    resumeId,
    open || contentMounted,
  )

  const reducedMotion = useReducedMotion()
  const profile = selected ?? record?.profile ?? 'graduate'
  const guide = PROFILE_GUIDES[profile]

  const copyExample = async () => {
    if (!resumeId || busy || reviewActive || !record) return

    const targetId = resumeId
    const targetOwner = ownerId
    const entryId = crypto.randomUUID()
    const section = guide.section
    const html = textToResumeHtml(guide.example)

    const item =
      section === 'work_experience'
        ? {
            entryId,
            hidden: false,
            companyName: '',
            position: '',
            workDuration: ['', ''],
            workInfo: html,
          }
        : {
            entryId,
            hidden: false,
            projectName: '',
            participantRole: '',
            projectDuration: ['', ''],
            projectInfo: html,
          }

    const evidence = collectSectionEvidence(
      section,
      { items: [item] },
      'example',
    )

    setBusy(true)

    try {
      // 先保存来源；失败时不写入正文。成功后同步守卫目标，避免迟到更新其他账户。
      await updatePreparation(targetId, targetOwner, (value) => ({
        ...value,
        profile,
        evidence: [...value.evidence, ...evidence],
      }))

      if (
        useResumeStore.getState().currentResumeId !== targetId ||
        (useUserStore.getState().currentUser?.id ?? null) !== targetOwner ||
        useResumeReviewStore.getState().active
      )
        return

      const state = useResumeStore.getState()

      if (section === 'work_experience') {
        state.updateForm(section, {
          items: [
            ...state.work_experience.items,
            item,
          ] as typeof state.work_experience.items,
        })
      } else {
        state.updateForm('project_experience', {
          items: [
            ...state.project_experience.items,
            item,
          ] as typeof state.project_experience.items,
        })
      }

      toast.success('示例已新增，请改成你自己的经历')
      pendingEditRef.current = { resumeId: targetId, section }
      setOpen(false)
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : '示例来源保存失败，尚未添加示例',
      )
    } finally {
      setBusy(false)
    }
  }

  const removeSource = async () => {
    if (!resumeId || busy) return

    setBusy(true)

    try {
      await updatePreparation(resumeId, ownerId, (value) => ({
        ...value,
        sourceText: undefined,
        sourceName: undefined,
        unassignedText: undefined,
      }))

      toast.success('保留的导入原文已删除，简历正文不受影响')
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : '删除失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant='outline'
          size={isMobile ? 'icon' : 'sm'}
          aria-label='填写建议'
          title='填写建议'
          disabled={!initialized || reviewActive}
        >
          <Lightbulb />
          {!isMobile && <span>填写建议</span>}
        </Button>
      </DialogTrigger>
      <DialogContent
        onOpenAutoFocus={() => setContentMounted(true)}
        onCloseAutoFocus={() => {
          // Radix 在退出完成后才卸载内容，读取状态应保留到此时。
          setContentMounted(false)

          const request = pendingEditRef.current

          pendingEditRef.current = null

          if (request)
            requestAnimationFrame(() => {
              if (
                useResumeStore.getState().currentResumeId === request.resumeId
              )
                usePreparationUiStore
                  .getState()
                  .requestEdit(request.resumeId, request.section)
            })
        }}
        style={{
          animationDuration: `${reducedMotion ? 0 : open ? DURATION.base : DURATION.fast}s`,
          animationTimingFunction: `cubic-bezier(${(open ? EASE.out : EASE.in).join(',')})`,
        }}
        className='max-h-[85dvh] overflow-y-auto sm:max-w-lg'
        overlayClassName='preparation-dialog-overlay'
      >
        <style>{`.preparation-dialog-overlay[data-state="open"]{animation-duration:${reducedMotion ? 0 : DURATION.base}s;animation-timing-function:cubic-bezier(${EASE.out.join(',')})}.preparation-dialog-overlay[data-state="closed"]{animation-duration:${reducedMotion ? 0 : DURATION.fast}s;animation-timing-function:cubic-bezier(${EASE.in.join(',')})}`}</style>
        <DialogHeader>
          <DialogTitle>填写建议</DialogTitle>
          <DialogDescription className='sr-only'>
            按求职阶段查看写法和参考示例。
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p role='status'>正在读取填写记录…</p>
        ) : error ? (
          <div role='alert'>
            <p>{error}</p>
            <Button variant='outline' onClick={retry} disabled={!open}>
              重试
            </Button>
          </div>
        ) : (
          <>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <Label htmlFor='preparation-profile'>求职阶段</Label>
              <Select
                value={profile}
                disabled={!open}
                onValueChange={(value) => setSelected(value as ResumeProfile)}
              >
                <SelectTrigger
                  id='preparation-profile'
                  className='w-40'
                  style={{
                    transitionDuration: `${reducedMotion ? 0 : DURATION.fast}s`,
                  }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  position='popper'
                  style={{
                    animationDuration: `${reducedMotion ? 0 : DURATION.fast}s`,
                  }}
                >
                  {Object.entries(PROFILE_GUIDES).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='relative'>
              <AnimatedContent
                animationKey={profile}
                mode='popLayout'
                className='space-y-5'
              >
                <section className='space-y-2.5' aria-label='写什么'>
                  <h3 className='text-sm font-medium'>写什么</h3>
                  <ol className='list-decimal space-y-2 pl-4 text-sm leading-6 text-muted-foreground'>
                    {guide.steps.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ol>
                </section>
                <Card size='sm' className='gap-3 shadow-none ring-inset'>
                  <CardHeader>
                    <CardTitle>{SECTION_LABELS[guide.section]}示例</CardTitle>
                  </CardHeader>
                  <CardContent className='text-sm leading-6'>
                    {guide.example}
                  </CardContent>
                  <CardFooter className='flex-wrap justify-between gap-3'>
                    <span className='text-xs text-muted-foreground'>
                      添加后，请改成你的真实经历。
                    </span>
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={!open || busy || reviewActive || !record}
                      onClick={copyExample}
                    >
                      {busy ? '正在添加…' : '添加并编辑'}
                    </Button>
                  </CardFooter>
                </Card>
              </AnimatedContent>
            </div>
            {record?.sourceText || record?.unassignedText ? (
              <Accordion type='single' collapsible className='border-t'>
                <AccordionItem value='source'>
                  <AccordionTrigger
                    className='min-w-0'
                    style={{
                      transitionDuration: `${reducedMotion ? 0 : DURATION.fast}s`,
                    }}
                  >
                    <span className='truncate'>
                      导入原文
                      {record.sourceName ? ` · ${record.sourceName}` : ''}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent
                    style={{
                      animationDuration: `${reducedMotion ? 0 : DURATION.base}s`,
                    }}
                    className='space-y-3'
                  >
                    <p className='text-xs text-muted-foreground'>
                      仅保存在本浏览器，不会导出。
                    </p>
                    {record.sourceText && (
                      <pre className='max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 font-sans text-sm'>
                        {record.sourceText}
                      </pre>
                    )}
                    {record.unassignedText && (
                      <>
                        <h4 className='text-sm font-medium'>未归类内容</h4>
                        <pre className='max-h-40 overflow-auto whitespace-pre-wrap break-words font-sans text-sm'>
                          {record.unassignedText}
                        </pre>
                      </>
                    )}
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={!open || busy}
                      onClick={removeSource}
                    >
                      删除原文
                    </Button>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
