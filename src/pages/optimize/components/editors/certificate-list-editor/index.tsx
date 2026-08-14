import type { KeyboardEvent } from 'react'
import type { CertificateItem } from '@/lib/schema/resume/form/honorsCertificates'
import { Plus, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { createResumeEntryId } from '@/lib/schema/resume/entry-id'
import { PRESET_CERTIFICATES } from '../../../const'

function CertificateListEditor({ value, onChange }: {
  value: CertificateItem[]
  onChange: (val: CertificateItem[]) => void
}) {
  const [customInput, setCustomInput] = useState('')

  const isCertAdded = (name: string) => value.some(c => c.name === name)

  const togglePresetCert = (name: string) => {
    if (isCertAdded(name)) {
      onChange(value.filter(c => c.name !== name))
    }
    else {
      onChange([{ entryId: createResumeEntryId(), name }, ...value])
    }
  }

  const addCustomCert = () => {
    const trimmed = customInput.trim()
    if (!trimmed || isCertAdded(trimmed))
      return
    onChange([{ entryId: createResumeEntryId(), name: trimmed }, ...value])
    setCustomInput('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addCustomCert()
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 快速添加 */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-muted-foreground">快速添加证书</label>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_CERTIFICATES.map(cert => (
            <Button
              key={cert}
              type="button"
              variant={isCertAdded(cert) ? 'default' : 'outline'}
              size="sm"
              onClick={() => togglePresetCert(cert)}
              className="h-7 text-xs"
            >
              {cert}
              {isCertAdded(cert) && <X className="ml-1 size-3" />}
            </Button>
          ))}
        </div>
      </div>

      {/* 自定义添加 */}
      <div className="flex gap-2">
        <Input
          placeholder="输入自定义证书名称"
          value={customInput}
          onChange={e => setCustomInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 h-9"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCustomCert}
          disabled={!customInput.trim()}
          className="h-9"
        >
          <Plus className="size-4 mr-1" />
          添加
        </Button>
      </div>

      {/* 已添加的证书 */}
      {value.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-wrap gap-2">
            <AnimatePresence mode="popLayout" initial={false}>
              {value.map(cert => (
                <motion.div
                  layout
                  key={`cert-${cert.name}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ opacity: { duration: 0.15 }, layout: { duration: 0.15 }, scale: { duration: 0.15 } }}
                >
                  <Badge
                    variant="outline"
                    className="text-sm px-3 py-1.5 gap-1.5 pr-1.5 border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
                  >
                    {cert.name}
                    <button
                      type="button"
                      className="size-4 rounded-full hover:bg-destructive/20 hover:text-destructive flex items-center justify-center transition-colors"
                      onClick={() => onChange(value.filter(c => c.name !== cert.name))}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  )
}

export default CertificateListEditor
