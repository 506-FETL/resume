import type React from 'react'
import dayjs from 'dayjs'
import { CheckCircle, ChevronDown, Cloud, CloudUpload, FileCheck, FileText, FolderOpen, HardDrive, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getAllOfflineResumes } from '@/lib/offline-resume-manager'
import supabase from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/supabase/user'
import { cn } from '@/lib/utils'
import useAtsStore from '../../../store'

interface ResumeConfig {
  id: string
  resume_id: string
  display_name: string
  isScored: boolean
  overall_score: number | null
  created_at: string
  isOffline?: boolean
}

export function ResumeManager() {
  const { atsConfigs, currentAtsConfig, loading } = useAtsStore()
  const [resumes, setResumes] = useState<ResumeConfig[]>([])
  const [selectedResumeId, setSelectedResumeId] = useState<string | undefined>()
  const [open, setOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    const initResumeConfig = async () => {
      if (loading)
        return

      const user = await getCurrentUser()

      if (!user)
        return

      const { data: userResumes, error: fetchResumesError } = await supabase
        .from('resume_config')
        .select('created_at,id,display_name,resume_id')
        .eq('user_id', user.id)

      if (fetchResumesError || !atsConfigs) {
        return
      }

      const structuredResumes = userResumes.map((resume) => {
        const resumeAts = atsConfigs.find(ats => ats.resume_id === resume.resume_id)

        if (resumeAts) {
          return {
            ...resume,
            isScored: true,
            overall_score: resumeAts.summary.overall_score,
            isOffline: false,
          }
        }
        else {
          return {
            ...resume,
            isScored: false,
            overall_score: null,
            isOffline: false,
          }
        }
      })

      const offlineResumes = await (await getAllOfflineResumes()).map(resume => ({
        id: resume.created_at,
        resume_id: resume.resume_id,
        display_name: resume.display_name,
        isScored: false,
        overall_score: null,
        created_at: resume.created_at,
        isOffline: true,
      }))

      setResumes([...structuredResumes, ...offlineResumes])
    }

    initResumeConfig()
  }, [atsConfigs, loading])

  useEffect(() => {
    if (!currentAtsConfig)
      return

    setSelectedResumeId(currentAtsConfig.resume_id)
  }, [currentAtsConfig])

  const selectedResumeName = resumes.find(r => r.resume_id === selectedResumeId)?.display_name || '选择简历'

  const handleSelect = (resume: ResumeConfig) => {
    setSelectedResumeId(resume.resume_id)
    setOpen(false)
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    // TODO: 处理文件上传
    const files = e.dataTransfer.files
    if (files.length > 0) {
      // 处理文件上传逻辑
    }
  }, [])

  const handleFileSelect = useCallback(() => {
    // TODO: 触发文件选择
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.doc,.docx'
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files
      if (files && files.length > 0) {
        // 处理文件选择逻辑
      }
    }
    input.click()
  }, [])

  // 分离在线和离线简历
  const onlineResumes = resumes.filter(r => !r.isOffline)
  const offlineResumes = resumes.filter(r => r.isOffline)

  // 获取当前选中简历的状态图标
  const currentResume = useMemo(() => resumes.find(r => r.resume_id === selectedResumeId), [resumes, selectedResumeId])
  const ButtonIcon = useMemo(() => {
    if (!currentResume)
      return FileText
    if (currentResume.isOffline) {
      return currentResume.isScored ? FileCheck : HardDrive
    }
    return currentResume.isScored ? FileCheck : Cloud
  }, [currentResume])

  const iconColorClass = useMemo(() => {
    if (!currentResume)
      return 'text-muted-foreground'
    if (currentResume.isScored)
      return 'text-green-600'
    return currentResume.isOffline ? 'text-amber-600' : 'text-blue-600'
  }, [currentResume])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
        >
          {loading
            ? <Spinner />
            : <ButtonIcon className={cn(iconColorClass)} />}
          <span className="truncate text-xs">{loading ? '加载中...' : selectedResumeName}</span>
          <ChevronDown className="shrink-0 opacity-50" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[500px] p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6">
          <DialogTitle className="text-base sm:text-lg">简历管理</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            选择现有简历或上传新文件进行分析
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="select" className="w-full">
          <div className="px-4 sm:px-6">
            <TabsList className="w-full">
              <TabsTrigger value="select" className="flex-1 gap-1.5 text-xs sm:text-sm">
                <FolderOpen className="size-3.5" />
                <span className="hidden xs:inline">选择</span>
                简历
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex-1 gap-1.5 text-xs sm:text-sm">
                <Upload className="size-3.5" />
                <span className="hidden xs:inline">上传</span>
                文件
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="select" className="mt-0 px-4 pb-4 sm:px-6 sm:pb-6">
            <ScrollArea className="h-[300px] sm:h-[350px] -mx-4 px-4 sm:-mx-6 sm:px-6">
              {loading
                ? (
                    <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                      <Spinner className="size-8 mb-3" />
                      <p className="text-sm">正在加载简历列表...</p>
                    </div>
                  )
                : (
                    <>
                      {/* 在线简历 */}
                      {onlineResumes.length > 0 && (
                        <div className="space-y-2 pt-3">
                          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-green-500" />
                            在线简历
                          </p>
                          {onlineResumes.map(resume => (
                            <ResumeItem
                              key={resume.id}
                              resume={resume}
                              isSelected={selectedResumeId === resume.resume_id}
                              onSelect={() => handleSelect(resume)}
                            />
                          ))}
                        </div>
                      )}

                      {/* 离线简历 */}
                      {offlineResumes.length > 0 && (
                        <div className="space-y-2 pt-4">
                          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-amber-500" />
                            本地简历
                          </p>
                          {offlineResumes.map(resume => (
                            <ResumeItem
                              key={resume.id}
                              resume={resume}
                              isSelected={selectedResumeId === resume.resume_id}
                              onSelect={() => handleSelect(resume)}
                            />
                          ))}
                        </div>
                      )}

                      {resumes.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                          <FileText className="size-10 mb-3 opacity-40" />
                          <p className="text-sm">暂无简历</p>
                          <p className="text-xs mt-1">请先上传简历文件</p>
                        </div>
                      )}
                    </>
                  )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="upload" className="mt-0 px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="pt-3 space-y-4">
              <div
                className={cn(
                  'border-2 border-dashed rounded-lg p-6 sm:p-8 text-center transition-all cursor-pointer',
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-muted-foreground/40 hover:bg-muted/50',
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleFileSelect}
              >
                <CloudUpload className={cn(
                  'size-10 sm:size-12 mx-auto mb-3 sm:mb-4 transition-colors',
                  isDragging ? 'text-primary' : 'text-muted-foreground',
                )}
                />
                <p className="text-sm font-medium">
                  {isDragging ? '释放以上传文件' : '点击上传或拖拽文件到此处'}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  支持 PDF, DOC, DOCX (最大 5MB)
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">或</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleFileSelect}
              >
                <FolderOpen className="size-4 mr-2" />
                从电脑中选择文件
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

interface ResumeItemProps {
  resume: ResumeConfig
  isSelected: boolean
  onSelect: () => void
}

function ResumeItem({ resume, isSelected, onSelect }: ResumeItemProps) {
  // 根据简历状态获取图标和颜色
  const getIconAndColor = () => {
    if (resume.isOffline) {
      // 本地简历
      if (resume.isScored) {
        return { Icon: FileCheck, bgColor: 'bg-green-500/10', iconColor: 'text-green-600' }
      }
      return { Icon: HardDrive, bgColor: 'bg-amber-500/10', iconColor: 'text-amber-600' }
    }
    else {
      // 在线简历
      if (resume.isScored) {
        return { Icon: FileCheck, bgColor: 'bg-green-500/10', iconColor: 'text-green-600' }
      }
      return { Icon: Cloud, bgColor: 'bg-blue-500/10', iconColor: 'text-blue-600' }
    }
  }

  const { Icon, bgColor, iconColor } = getIconAndColor()

  return (
    <div
      className={cn(
        'flex items-center justify-between p-2.5 sm:p-3 rounded-md border transition-all cursor-pointer',
        isSelected
          ? 'bg-accent border-primary/50 ring-1 ring-primary/20'
          : 'hover:bg-muted/70',
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        <div className={cn('p-1.5 sm:p-2 rounded shrink-0', bgColor)}>
          <Icon className={cn('size-3.5 sm:size-4', iconColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <p className="text-xs sm:text-sm font-medium truncate" title={resume.display_name}>
              {resume.display_name}
            </p>
            {resume.isScored
              ? (
                  <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-50 dark:bg-green-950/30 shrink-0 text-[10px] px-1.5 py-0">
                    已打分
                  </Badge>
                )
              : (
                  <Badge variant="outline" className="text-muted-foreground shrink-0 text-[10px] px-1.5 py-0">
                    待分析
                  </Badge>
                )}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground mt-0.5">
            <span>{dayjs(resume.created_at).fromNow()}</span>
            {resume.isScored && resume.overall_score != null && resume.overall_score > 0 && (
              <>
                <span>•</span>
                <span className={cn(
                  'font-medium',
                  resume.overall_score >= 80 ? 'text-green-600' : resume.overall_score >= 60 ? 'text-amber-600' : 'text-red-600',
                )}
                >
                  {resume.overall_score}
                  {' '}
                  分
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      {isSelected && (
        <div className="text-primary shrink-0 ml-2">
          <CheckCircle className="size-4" />
        </div>
      )}
    </div>
  )
}
