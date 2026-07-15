import { Plus, Trash2, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useIsMobile } from '@/hooks/use-mobile'
import { honorsCertificatesFormSchema, PRESET_CERTIFICATES } from '@/lib/schema'
import { cn } from '@/lib/utils'
import { RichTextFieldEditor } from '@/pages/resume/editor/components/forms/shared/rich-text-field-editor'
import useResumeStore from '@/store/resume/form'
import { useResumeFieldForm } from '../hooks/use-resume-field-form'

function HonorsCertificatesForm({ className }: { className?: string }) {
  const honorsCertificates = useResumeStore(state => state.honors_certificates)
  const jobIntentText = useResumeStore(state => state.job_intent.jobIntent)
  const isMobile = useIsMobile()
  const [customCertificateInput, setCustomCertificateInput] = useState('')

  const storeFormData = useMemo(() => ({
    description: honorsCertificates.description || '',
    certificates: honorsCertificates.certificates || [],
  }), [honorsCertificates.description, honorsCertificates.certificates])

  const { form, fields, append, remove } = useResumeFieldForm({
    fieldName: 'honors_certificates',
    schema: honorsCertificatesFormSchema,
    storeFormData,
    arrayFieldName: 'certificates',
  })

  // 检查预设证书是否已添加
  const isPresetCertificateAdded = (certificate: string) => {
    return fields.some(field => field.name === certificate)
  }

  // 切换预设证书
  const togglePresetCertificate = (certificate: string) => {
    const existingIndex = fields.findIndex(field => field.name === certificate)
    if (existingIndex >= 0) {
      remove(existingIndex)
    }
    else {
      append({ name: certificate } as any)
    }
  }

  // 添加自定义证书
  const addCustomCertificate = () => {
    const trimmedValue = customCertificateInput.trim()
    if (!trimmedValue) {
      toast.warning('证书名称不能为空', {
        description: '请输入有效的证书名称',
      })
      return
    }

    // 检查是否已存在
    if (fields.some(field => field.name === trimmedValue)) {
      toast.error('证书已存在', {
        description: `"${trimmedValue}" 已经添加过了`,
      })
      return
    }

    append({ name: trimmedValue } as any)
    setCustomCertificateInput('')
  }

  return (
    <Form {...form}>
      <form id="honors-certificates-form">
        <div className={cn('space-y-6', className)}>
          <FormField
            name="description"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>荣誉证书描述</FormLabel>
                <FormControl>
                  <RichTextFieldEditor
                    sectionKey="honors_certificates"
                    relativePath="description"
                    value={field.value || ''}
                    onChange={field.onChange}
                    fieldContext={{ sectionKey: 'honors_certificates', fieldLabel: '荣誉证书描述', jobIntent: jobIntentText }}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <Separator />

          {/* 预设证书标签 */}
          <div className="space-y-4">
            <FormLabel>快速添加证书</FormLabel>
            <div className="flex flex-wrap gap-2">
              {PRESET_CERTIFICATES.map(certificate => (
                <Button
                  key={certificate}
                  type="button"
                  variant={isPresetCertificateAdded(certificate) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => togglePresetCertificate(certificate)}
                  className="h-8"
                >
                  {certificate}
                  {isPresetCertificateAdded(certificate) && <X className="ml-1 size-3" />}
                </Button>
              ))}
            </div>
          </div>

          {/* 自定义证书输入 */}
          <div className="space-y-4">
            <FormLabel>添加自定义证书</FormLabel>
            <div className="flex gap-2 max-w-md">
              <Input
                placeholder="输入证书名称"
                value={customCertificateInput}
                onChange={e => setCustomCertificateInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCustomCertificate()
                  }
                }}
                className="flex-1"
              />
              <Button type="button" variant="outline" size={isMobile ? 'sm' : 'default'} onClick={addCustomCertificate}>
                <Plus className="size-4" />
                {!isMobile && <span className="ml-2">添加</span>}
              </Button>
            </div>
          </div>

          {fields.length > 0 && (
            <div className="space-y-4">
              <FormLabel>已添加的证书</FormLabel>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {fields.map((item, index) => {
                  const certificateValue = form.watch(`certificates.${index}.name`)
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.96, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: -20 }}
                      transition={{
                        duration: 0.5,
                        ease: [0.34, 1.56, 0.64, 1],
                      }}
                      layout
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:shadow-md transition-shadow"
                    >
                      <span className="font-medium text-base truncate flex-1">{certificateValue}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          remove(index)
                        }}
                        className="size-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </form>
    </Form>
  )
}

export default HonorsCertificatesForm
