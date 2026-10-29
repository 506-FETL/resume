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
import { hobbiesFormSchema, PRESET_HOBBIES } from '@/lib/schema'
import { createResumeEntryId } from '@/lib/schema/resume/entry-id'
import { cn } from '@/lib/utils'
import useResumeStore from '@/store/resume/form'
import { useResumeFieldForm } from '../hooks/use-resume-field-form'
import { ResumeFieldExitSnapshot } from '../shared/resume-field-exit-snapshot'
import { focusBeforeFieldRemoval } from '../shared/focus-before-field-removal'
import { RichTextFieldEditor } from '../shared/rich-text-field-editor'

function HobbiesForm({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion()
  const [hobbies] = useState(() => useResumeStore.getState().hobbies)
  const jobIntentText = useResumeStore((state) => state.job_intent.jobIntent)
  const isMobile = useIsMobile()
  const [customHobbyInput, setCustomHobbyInput] = useState('')

  const storeFormData = useMemo(
    () => ({
      description: hobbies.description || '',
      hobbies: hobbies.hobbies || [],
    }),
    [hobbies.description, hobbies.hobbies],
  )

  const { form, fields, append, remove, sync } = useResumeFieldForm({
    fieldName: 'hobbies',
    schema: hobbiesFormSchema,
    storeFormData,
    arrayFieldName: 'hobbies',
  })

  // 检查预设爱好是否已添加
  const isPresetHobbyAdded = (hobby: string) => {
    return fields.some((field) => field.name === hobby)
  }

  // 切换预设爱好
  const togglePresetHobby = (hobby: string) => {
    const existingIndex = fields.findIndex((field) => field.name === hobby)

    if (existingIndex >= 0) {
      remove(existingIndex)
    } else {
      append({ entryId: createResumeEntryId(), name: hobby })
    }
  }

  // 添加自定义爱好
  const addCustomHobby = () => {
    const trimmedValue = customHobbyInput.trim()

    if (!trimmedValue) {
      toast.warning('爱好名称不能为空')

      return
    }

    // 检查是否已存在
    if (fields.some((field) => field.name === trimmedValue)) {
      toast.error('爱好已存在', {
        description: `"${trimmedValue}" 已经添加过了`,
      })

      return
    }

    append({ entryId: createResumeEntryId(), name: trimmedValue })
    setCustomHobbyInput('')
  }

  return (
    <Form {...form}>
      {sync}
      <form id='hobbies-form'>
        <div className={cn('space-y-6', className)}>
          <FormField
            name='description'
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>兴趣爱好描述</FormLabel>
                <FormControl>
                  <RichTextFieldEditor
                    sectionKey='hobbies'
                    relativePath='description'
                    value={field.value || ''}
                    onChange={field.onChange}
                    fieldContext={{
                      sectionKey: 'hobbies',
                      fieldLabel: '兴趣爱好描述',
                      jobIntent: jobIntentText,
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <Separator />

          {/* 预设爱好标签 */}
          <div className='space-y-4'>
            <FormLabel>快速添加爱好</FormLabel>
            <div className='flex flex-wrap gap-2'>
              {PRESET_HOBBIES.map((hobby) => (
                <Button
                  key={hobby}
                  type='button'
                  variant={isPresetHobbyAdded(hobby) ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => togglePresetHobby(hobby)}
                  className='h-8'
                >
                  {hobby}
                  {isPresetHobbyAdded(hobby) && <X className='ml-1 size-3' />}
                </Button>
              ))}
            </div>
          </div>

          {/* 自定义爱好输入 */}
          <motion.div
            layout={reduceMotion ? false : 'position'}
            layoutDependency={fields.length}
            transition={{
              layout: reduceMotion ? { duration: 0 } : SPRING.layout,
            }}
            className='space-y-4'
          >
            <FormLabel>添加自定义爱好</FormLabel>
            <div className='flex gap-2 max-w-md'>
              <Input
                aria-label='爱好名称'
                placeholder='输入爱好名称'
                value={customHobbyInput}
                onChange={(e) => setCustomHobbyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCustomHobby()
                  }
                }}
                className='flex-1'
              />
              <Button
                type='button'
                variant='outline'
                size={isMobile ? 'sm' : 'default'}
                data-resume-field-add
                aria-label='添加爱好'
                onClick={addCustomHobby}
              >
                <Plus className='size-4' />
                {!isMobile && <span className='ml-2'>添加</span>}
              </Button>
            </div>
          </motion.div>

          {/* 爱好列表 */}
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
                <FormLabel>已添加的爱好</FormLabel>
                <div className='grid min-w-0 grid-cols-1 gap-3 @2xl/panel:grid-cols-2 @5xl/panel:grid-cols-3'>
                  <AnimatePresence initial={false} mode='popLayout' propagate>
                    {fields.map((item, index) => {
                      const hobbyValue = form.watch(`hobbies.${index}.name`)

                      const hidden = form.watch(
                        `hobbies.${index}.hidden` as any,
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
                            'flex min-w-0 items-center justify-between gap-3 p-4 rounded-lg border bg-card hover:shadow-md transition-shadow',
                            hidden && 'opacity-50',
                          )}
                        >
                          <ResumeFieldExitSnapshot>
                            <span className='min-w-0 font-medium text-base truncate flex-1'>
                              {hobbyValue}
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
                                        `hobbies.${index}.hidden` as any,
                                        !hidden as any,
                                        { shouldDirty: true },
                                      )
                                    }}
                                    aria-label={`${hidden ? '显示' : '隐藏'}爱好 ${hobbyValue}`}
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
                                    ? '显示此爱好'
                                    : '隐藏此爱好（内容保留）'}
                                </TooltipContent>
                              </Tooltip>
                              <Button
                                type='button'
                                variant='ghost'
                                size='sm'
                                data-resume-field-remove
                                aria-label={`删除爱好 ${hobbyValue}`}
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

export default HobbiesForm
