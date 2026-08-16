import type { FormEvent } from 'react'
import type { ResumeType } from '@/lib/schema'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createOfflineResume } from '@/lib/offline-resume-manager'
import { createNewResume } from '@/lib/supabase/resume/form'
import useResumeListStore from '@/pages/resume/store'
import useCurrentResumeStore from '@/store/resume/current'
import { getErrorMessage } from '@/utils'

export default function CreateResumeCard() {
  const { isOnline, addResume } = useResumeListStore()
  const { setCurrentResume } = useCurrentResumeStore()

  const [isCreating, setIsCreating] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedType, setSelectedType] = useState<ResumeType>('default')
  const [loading, setLoading] = useState(false)

  async function handleCreateResume(e: FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      if (isOnline) {
        // 在线模式：创建云端简历
        const createPromise = createNewResume(
          { display_name: displayName.trim(), description: description.trim() },
          selectedType,
        )
          .then((data) => {
            addResume({
              resume_id: data.resume_id,
              created_at: data.created_at,
              updated_at: data.updated_at,
              type: data.type,
              display_name: data.display_name,
              description: data.description,
              isOffline: false,
            })
            setCurrentResume(data.resume_id, data.type)
            return data
          })
          .finally(() => {
            setLoading(false)
            handleCancel()
          })

        toast.promise(createPromise, {
          loading: '正在创建简历...',
          success: '简历创建成功',
          error: error => `创建简历失败: ${error.message}，请重试`,
        })
      }
      else {
        // 离线模式：创建本地简历
        const resumeId = await createOfflineResume({
          display_name: displayName.trim(),
          description: description.trim(),
          type: selectedType,
        })

        setCurrentResume(resumeId, selectedType)
        addResume({
          resume_id: resumeId,
          created_at: new Date().toISOString(),
          type: selectedType,
          display_name: displayName.trim(),
          description: description.trim(),
          isOffline: true,
        })

        toast.success('本地简历创建成功')
        setLoading(false)
        handleCancel()
      }
    }
    catch (error: unknown) {
      setLoading(false)
      toast.error(`创建失败: ${getErrorMessage(error)}`)
    }
  }

  function handleCancel() {
    setDisplayName('')
    setDescription('')
    setSelectedType('default')
    setIsCreating(false)
  }

  return (
    <section className="h-full">
      <Card
        className="hover:shadow-lg transition-all duration-300 cursor-pointer border-dashed border-2 hover:border-primary/50 h-full flex flex-col items-center justify-center"
        onClick={() => setIsCreating(true)}
      >
        <CardHeader className="flex justify-center">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Plus className="size-8" />
          </div>
        </CardHeader>
        <CardContent className="flex justify-center">
          <p className="font-semibold text-lg">创建新简历</p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">开始制作你的专属简历</p>
        </CardFooter>
      </Card>
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="sm:max-w-135">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">创建新简历</DialogTitle>
            <DialogDescription className="sr-only">填写简历名称、描述并选择基础模板类型。</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateResume}>
            <FieldGroup className="gap-6 py-6">
              {/* 简历名称 */}
              <Field>
                <FieldLabel htmlFor="display_name">简历名称</FieldLabel>
                <Input
                  id="display_name"
                  placeholder="例如: 前端开发工程师简历"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  maxLength={50}
                  className="h-11"
                />
                <FieldDescription>
                  为你的简历起一个容易识别的名称 (
                  {displayName.length}
                  /50)
                </FieldDescription>
              </Field>

              {/* 简历描述 */}
              <Field>
                <FieldLabel htmlFor="description">简历描述</FieldLabel>
                <Textarea
                  id="description"
                  placeholder="例如: 用于投递互联网公司的前端技术岗位"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  maxLength={200}
                  className="resize-none"
                />
                <FieldDescription>
                  简要描述这份简历的用途 (
                  {description.length}
                  /200)
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="template_type">基础模板类型</FieldLabel>
                <Select value={selectedType} onValueChange={value => setSelectedType(value as ResumeType)}>
                  <SelectTrigger className="h-11" id="template_type">
                    <SelectValue placeholder="选择基础模板类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="default">默认</SelectItem>
                      <SelectItem value="modern">现代</SelectItem>
                      <SelectItem value="simple">简约</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>
                取消
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? '创建中...' : '创建简历'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
