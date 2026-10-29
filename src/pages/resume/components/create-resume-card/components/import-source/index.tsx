import { useRef, useState } from 'react'
import { FileText, LoaderCircle, Upload } from 'lucide-react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { DURATION } from '@/lib/motion'
import type { ImportStage } from '@/lib/resume-import/organize'
import { cn } from '@/lib/utils'
import { useCreationDraftStore } from '../../store'

export default function ImportSource({
  onFile,
  onParse,
  onCancel,
  stage,
}: {
  onFile: (file: File) => Promise<void>
  onParse: () => Promise<void>
  onCancel: () => void
  stage: ImportStage | null
}) {
  const reduceMotion = useReducedMotion()
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState('file')
  const [dragging, setDragging] = useState(false)
  const draft = useCreationDraftStore((state) => state.draft)
  const patch = useCreationDraftStore((state) => state.patch)
  const locked = Boolean(draft.creation)

  return (
    <div className='space-y-4'>
      <p className='text-sm text-muted-foreground'>
        自动填入姓名、联系方式和经历，随后可直接选择模板。
      </p>
      <Tabs
        value={mode}
        onValueChange={(value) => {
          onCancel()
          setMode(value)
        }}
      >
        <TabsList aria-label='导入方式'>
          <TabsTrigger
            value='file'
            disabled={locked}
            className='motion-reduce:transition-none'
          >
            上传文件
          </TabsTrigger>
          <TabsTrigger
            value='text'
            disabled={locked}
            className='motion-reduce:transition-none'
          >
            粘贴文字
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value='file'
          style={{ animationDuration: `${reduceMotion ? 0 : DURATION.base}s` }}
        >
          <div
            className={cn(
              'mt-2 flex flex-col items-center rounded-xl border border-dashed px-5 py-9 text-center transition-colors motion-reduce:transition-none',
              dragging ? 'border-primary bg-accent' : 'bg-muted/20',
            )}
            onDragOver={(event) => {
              event.preventDefault()

              if (!locked) setDragging(true)
            }}
            onDragLeave={(event) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null,
                )
              )
                setDragging(false)
            }}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)

              const file = event.dataTransfer.files[0]

              if (file && !locked) onFile(file)
            }}
          >
            <FileText
              className='mb-4 size-8 text-muted-foreground'
              aria-hidden
            />
            <p className='mb-3 text-sm font-medium'>
              将旧简历拖到这里，自动识别并填充
            </p>
            <Button disabled={locked} onClick={() => fileRef.current?.click()}>
              <Upload className='size-4' />
              {stage ? '换一个文件' : '选择简历文件'}
            </Button>
            <p className='mt-4 text-xs leading-5 text-muted-foreground'>
              PDF、DOCX · 最大 10 MB · PDF 最多 30 页
            </p>
            <p className='text-xs leading-5 text-muted-foreground'>
              扫描件、加密文件和 DOC 可改用粘贴文字
            </p>
            <input
              ref={fileRef}
              type='file'
              accept='.pdf,.docx'
              className='sr-only'
              tabIndex={-1}
              aria-label='选择旧简历文件'
              onChange={(event) => {
                const file = event.target.files?.[0]

                event.target.value = ''

                if (file) onFile(file)
              }}
            />
          </div>
        </TabsContent>
        <TabsContent
          value='text'
          className='space-y-3'
          style={{ animationDuration: `${reduceMotion ? 0 : DURATION.base}s` }}
        >
          <label className='block space-y-2'>
            <span className='text-sm font-medium'>简历内容</span>
            <Textarea
              aria-label='简历内容'
              rows={8}
              maxLength={60000}
              disabled={locked}
              className='max-h-72 min-h-40 resize-y'
              placeholder='粘贴完整简历，无需按模块手动拆分…'
              value={draft.sourceText}
              onChange={(event) => {
                onCancel()

                patch({
                  sourceText: event.target.value,
                  sourceName: '粘贴内容',
                  content: null,
                  selectedTemplate: undefined,
                })
              }}
            />
          </label>
          <div className='flex items-center justify-between gap-3'>
            <span className='text-xs text-muted-foreground'>
              {draft.sourceText.length.toLocaleString()} / 60,000 字符
            </span>
            <Button
              disabled={Boolean(stage) || locked || !draft.sourceText.trim()}
              onClick={() => onParse()}
            >
              自动填充
            </Button>
          </div>
        </TabsContent>
      </Tabs>
      {stage && (
        <div
          role='status'
          aria-live='polite'
          className='flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm'
        >
          <LoaderCircle className='size-4 shrink-0 animate-spin motion-reduce:animate-none' />
          <span className='flex-1'>
            {stage === 'reading' ? '正在读取文件…' : '正在识别并填充内容…'}
          </span>
          <Button size='sm' variant='ghost' onClick={onCancel}>
            取消
          </Button>
        </div>
      )}
      <p className='text-xs leading-5 text-muted-foreground'>
        文件在本机读取；登录后会发送提取文字进行免费智能识别，不占 AI 额度。
      </p>
    </div>
  )
}
