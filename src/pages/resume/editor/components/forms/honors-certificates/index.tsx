import { Eye, EyeOff, Plus, Trash2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { PresenceDiv } from '@/components/motion/presence-item'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useIsMobile } from '@/hooks/use-mobile'
import { DURATION, EASE, SPRING } from '@/lib/motion'
import { honorsCertificatesFormSchema, PRESET_CERTIFICATES } from '@/lib/schema'
import { createResumeEntryId } from '@/lib/schema/resume/entry-id'
import { cn } from '@/lib/utils'
import { RichTextFieldEditor } from '@/pages/resume/editor/components/forms/shared/rich-text-field-editor'
import useResumeStore from '@/store/resume/form'
import { useResumeFieldForm } from '../hooks/use-resume-field-form'
import { ResumeFieldExitSnapshot } from '../shared/resume-field-exit-snapshot'
import { focusBeforeFieldRemoval } from '../shared/focus-before-field-removal'

function HonorsCertificatesForm({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion()

  const [honorsCertificates] = useState(
    () => useResumeStore.getState().honors_certificates,
  )

  const jobIntentText = useResumeStore((state) => state.job_intent.jobIntent)
  const isMobile = useIsMobile()
  const [customCertificateInput, setCustomCertificateInput] = useState('')

  const storeFormData = useMemo(
    () => ({
      description: honorsCertificates.description || '',
      certificates: honorsCertificates.certificates || [],
    }),
    [honorsCertificates.description, honorsCertificates.certificates],
  )

  const { form, fields, append, remove, sync } = useResumeFieldForm({
    fieldName: 'honors_certificates',
    schema: honorsCertificatesFormSchema,
    storeFormData,
    arrayFieldName: 'certificates',
  })

  // 检查预设证书是否已添加
  const isPresetCertificateAdded = (certificate: string) => {
    return fields.some((field) => field.name === certificate)
  }

  // 切换预设证书
  const togglePresetCertificate = (certificate: string) => {
    const existingIndex = fields.findIndex(
      (field) => field.name === certificate,
    )

    if (existingIndex >= 0) {
      remove(existingIndex)
    } else {
      append({ entryId: createResumeEntryId(), name: certificate })
    }
  }

  // 添加自定义证书
  const addCustomCertificate = () => {
    const trimmedValue = customCertificateInput.trim()

    if (!trimmedValue) {
      toast.warning('证书名称不能为空')

      return
    }

    // 检查是否已存在
    if (fields.some((field) => field.name === trimmedValue)) {
      toast.error('证书已存在', {
        description: `"${trimmedValue}" 已经添加过了`,
      })

      return
    }

    append({ entryId: createResumeEntryId(), name: trimmedValue })
    setCustomCertificateInput('')
  }

  return (
    <Form {...form}>
      {sync}
      <form id='honors-certificates-form'>
        <div className={cn('space-y-6', className)}>
          <FormField
            name='description'
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>荣誉证书描述</FormLabel>
                <FormControl>
                  <RichTextFieldEditor
                    sectionKey='honors_certificates'
                    relativePath='description'
                    value={field.value || ''}
                    onChange={field.onChange}
                    fieldContext={{
                      sectionKey: 'honors_certificates',
                      fieldLabel: '荣誉证书描述',
                      jobIntent: jobIntentText,
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <Separator />

          {/* 预设证书标签 */}
          <div className='space-y-4'>
            <FormLabel>快速添加证书</FormLabel>
            <div className='flex flex-wrap gap-2'>
              {PRESET_CERTIFICATES.map((certificate) => (
                <Button
                  key={certificate}
                  type='button'
                  variant={
                    isPresetCertificateAdded(certificate)
                      ? 'default'
                      : 'outline'
                  }
                  size='sm'
                  onClick={() => togglePresetCertificate(certificate)}
                  className='h-8'
                >
                  {certificate}
                  {isPresetCertificateAdded(certificate) && (
                    <X className='ml-1 size-3' />
                  )}
                </Button>
              ))}
            </div>
          </div>

          {/* 自定义证书输入 */}
          <motion.div
            layout={reduceMotion ? false : 'position'}
            layoutDependency={fields.length}
            transition={{
              layout: reduceMotion ? { duration: 0 } : SPRING.layout,
            }}
            className='space-y-4'
          >
            <FormLabel>添加自定义证书</FormLabel>
            <div className='flex gap-2 max-w-md'>
              <Input
                aria-label='证书名称'
                placeholder='输入证书名称'
                value={customCertificateInput}
                onChange={(e) => setCustomCertificateInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCustomCertificate()
                  }
                }}
                className='flex-1'
              />
              <Button
                type='button'
                variant='outline'
                size={isMobile ? 'sm' : 'default'}
                data-resume-field-add
                aria-label='添加证书'
                onClick={addCustomCertificate}
              >
                <Plus className='size-4' />
                {!isMobile && <span className='ml-2'>添加</span>}
              </Button>
            </div>
          </motion.div>

          <AnimatePresence initial={false}>
            {fields.length > 0 && (
              <PresenceDiv
                key='added-fields'
                initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{
                  opacity: 0,
                  height: 0,
                  transition: {
                    duration: reduceMotion ? 0 : DURATION.fast,
                    ease: EASE.in,
                  },
                }}
                transition={{
                  duration: reduceMotion ? 0 : DURATION.base,
                  ease: EASE.out,
                }}
                className='flex min-w-0 flex-col gap-4'
              >
                <FormLabel>已添加的证书</FormLabel>
                <div className='grid min-w-0 grid-cols-1 gap-3 @2xl/panel:grid-cols-2 @5xl/panel:grid-cols-3'>
                  <AnimatePresence initial={false} mode='popLayout' propagate>
                    {fields.map((item, index) => {
                      const certificateValue = form.watch(
                        `certificates.${index}.name`,
                      )

                      const hidden = form.watch(
                        `certificates.${index}.hidden` as any,
                      )

                      return (
                        <PresenceDiv
                          key={item.id}
                          data-resume-field-row
                          initial={
                            reduceMotion
                              ? false
                              : { opacity: 0, scale: 0.96, y: 8 }
                          }
                          animate={{
                            opacity: hidden ? 0.5 : 1,
                            scale: 1,
                            y: 0,
                          }}
                          transition={{
                            duration: reduceMotion ? 0 : DURATION.base,
                            ease: EASE.out,
                            layout: reduceMotion
                              ? { duration: 0 }
                              : SPRING.layout,
                          }}
                          exit={{
                            opacity: 0,
                            scale: reduceMotion ? 1 : 0.98,
                            transition: {
                              duration: reduceMotion ? 0 : DURATION.fast,
                              ease: EASE.in,
                            },
                          }}
                          layout={reduceMotion ? false : 'position'}
                          className={cn(
                            'flex min-w-0 items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:shadow-md transition-shadow',
                            hidden && 'opacity-50',
                          )}
                        >
                          <ResumeFieldExitSnapshot>
                            <span className='min-w-0 font-medium text-base truncate flex-1'>
                              {certificateValue}
                            </span>
                            <div className='flex shrink-0 items-center gap-0.5'>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type='button'
                                    variant='ghost'
                                    size='sm'
                                    onClick={() => {
                                      form.setValue(
                                        `certificates.${index}.hidden` as any,
                                        !hidden as any,
                                        { shouldDirty: true },
                                      )
                                    }}
                                    aria-label={`${hidden ? '显示' : '隐藏'}证书 ${certificateValue}`}
                                    className='size-8 p-0'
                                  >
                                    {hidden ? (
                                      <EyeOff className='size-4' />
                                    ) : (
                                      <Eye className='size-4' />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {hidden
                                    ? '显示此证书'
                                    : '隐藏此证书（内容保留）'}
                                </TooltipContent>
                              </Tooltip>
                              <Button
                                type='button'
                                variant='ghost'
                                size='sm'
                                data-resume-field-remove
                                aria-label={`删除证书 ${certificateValue}`}
                                onClick={(event) => {
                                  focusBeforeFieldRemoval(event.currentTarget)
                                  remove(index)
                                }}
                                className='size-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0'
                              >
                                <Trash2 className='size-4' />
                              </Button>
                            </div>
                          </ResumeFieldExitSnapshot>
                        </PresenceDiv>
                      )
                    })}
                  </AnimatePresence>
                </div>
              </PresenceDiv>
            )}
          </AnimatePresence>
        </div>
      </form>
    </Form>
  )
}

export default HonorsCertificatesForm
