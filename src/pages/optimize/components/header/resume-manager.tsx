import { ChevronDown, CloudUpload, FileText, FolderOpen, Upload } from 'lucide-react'
import AnimatedContent from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { ResumeItem } from './resume-item'
import { useResumeManager } from './use-resume-manager'

export function ResumeManager() {
  const {
    loading,
    loadError,
    retry,
    open,
    setOpen,
    isDragging,
    selectedResumeName,
    selectedResumeId,
    onlineResumes,
    offlineResumes,
    ButtonIcon,
    iconColorClass,
    handleSelect,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileSelect,
    resumes,
  } = useResumeManager()
  const initialLoading = loading && resumes.length === 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={initialLoading}
        >
          {initialLoading
            ? <Spinner />
            : <ButtonIcon className={cn(iconColorClass)} />}
          <span className="truncate text-xs">{initialLoading ? '加载中...' : selectedResumeName}</span>
          <ChevronDown className="shrink-0 opacity-50" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[500px] p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6">
          <DialogTitle className="text-base sm:text-lg">简历管理</DialogTitle>
          <DialogDescription className="sr-only">
            选择或上传待分析的简历。
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
              <AnimatedContent animationKey={resumes.length ? 'resumes' : initialLoading ? 'loading' : loadError ? 'error' : 'empty'}>
                {initialLoading
                  ? (
                      <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                        <Spinner className="size-8 mb-3" />
                        <p className="text-sm">正在加载简历列表...</p>
                      </div>
                    )
                  : (
                      <>
                        <AnimatedContent animationKey={loadError ? 'error' : 'ready'}>
                          {loadError && (
                            <div role="alert" className="flex items-center justify-between gap-3 pt-3 text-sm text-muted-foreground">
                              <p>{resumes.length ? '部分简历加载失败，已显示可用简历。' : '简历列表加载失败，请重试。'}</p>
                              <Button size="sm" variant="outline" disabled={loading} onClick={() => { retry() }}>重试</Button>
                            </div>
                          )}
                        </AnimatedContent>
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

                        {resumes.length === 0 && !loadError && (
                          <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                            <FileText className="size-10 mb-3 opacity-40" />
                            <p className="text-sm">暂无简历</p>
                            <p className="text-xs mt-1">请先在“我的简历”中创建简历</p>
                          </div>
                        )}
                      </>
                    )}
              </AnimatedContent>
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
