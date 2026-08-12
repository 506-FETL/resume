import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import { LoaderCircle, RefreshCcw } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { getResumeSnapshotById } from '@/lib/supabase/resume/share'
import CreateDialog from './components/create-dialog'
import EmptyState from './components/empty-state'
import Grid from './components/grid'
import Header from './components/header'
import MobileList from './components/mobile-list'
import ActionDrawer from './components/mobile-list/action-drawer'
import SettingsDialog from './components/settings-dialog'
import Toolbar from './components/toolbar'
import { useSharePageBootstrap } from './hooks/use-share-page-bootstrap'
import useShareStore from './store'
import { buildShareUrl, deriveShareStatus, filterShares } from './utils'

export default function Management() {
  useSharePageBootstrap()
  const reduceMotion = useReducedMotion()
  const { allShares, resumeMap, pageLoading, error, mutatingId, searchKeyword, resumeFilters, statusFilter, actionShare, actionTrigger, setSearchKeyword, setResumeFilters, setStatusFilter, setActionShare, create, setActive, updateSettings, pushSnapshot, remove, reloadPage } = useShareStore()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [settingsShare, setSettingsShare] = useState<ResumeShareRecord | null>(null)
  const [deleteShare, setDeleteShare] = useState<ResumeShareRecord | null>(null)

  const resumes = useMemo(
    () => Object.values(resumeMap).sort((left, right) => left.displayName.localeCompare(right.displayName)),
    [resumeMap],
  )
  const filteredShares = useMemo(
    () => filterShares(allShares, {
      keyword: searchKeyword,
      resumeIds: resumeFilters,
      status: statusFilter,
    }),
    [allShares, resumeFilters, searchKeyword, statusFilter],
  )
  const activeCount = allShares.filter(share => deriveShareStatus(share) === 'active').length
  const hasFilter = Boolean(searchKeyword.trim()) || resumeFilters.length > 0 || statusFilter !== 'all'

  const handlePreview = (share: ResumeShareRecord) => {
    window.open(buildShareUrl(share.token), '_blank', 'noopener,noreferrer')
  }

  const handleOpenSettings = (share: ResumeShareRecord) => {
    setActionShare(null)
    setSettingsShare(share)
  }

  const handleSaveSettings = async (settings: {
    label: string | null
    expiresAt: string | null
    password: string | null | undefined
  }) => {
    if (!settingsShare)
      return
    try {
      await updateSettings(settingsShare.id, settings)
      toast.success('分享设置已更新')
      setSettingsShare(null)
    }
    catch {
      toast.error('保存设置失败')
    }
  }

  const handlePushLatest = async (share: ResumeShareRecord) => {
    try {
      const source = await getResumeSnapshotById(share.resume_id)
      await pushSnapshot(
        share.id,
        source.snapshot,
        source.templateManifest,
        source.displayName,
      )
      toast.success('已推送最新版')
      setActionShare(null)
    }
    catch {
      toast.error('推送失败')
    }
  }

  const handleToggleActive = async (share: ResumeShareRecord) => {
    try {
      await setActive(share.id, !share.is_active)
      toast.success(share.is_active ? '链接已关闭' : '链接已启用')
      setActionShare(null)
    }
    catch {
      toast.error('操作失败')
    }
  }

  const handleDelete = async () => {
    if (!deleteShare)
      return
    try {
      await remove(deleteShare.id)
      toast.success('分享链接已永久删除')
      setDeleteShare(null)
      setActionShare(null)
    }
    catch {
      toast.error('删除失败')
    }
  }

  const handleCreate = () => {
    setCreateDialogOpen(true)
  }

  const handleCreateShare = async (resumeId: string, options: Parameters<typeof create>[4]) => {
    const source = await getResumeSnapshotById(resumeId)
    await create(
      resumeId,
      source.snapshot,
      source.templateManifest,
      source.displayName,
      options,
    )
  }

  if (pageLoading && allShares.length === 0) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center text-muted-foreground">
        <LoaderCircle className="mr-2 size-4 animate-spin" />
        正在加载分享链接…
      </div>
    )
  }

  if (error && allShares.length === 0) {
    return (
      <div className="mx-auto w-full max-w-7xl p-4 md:p-8">
        <Empty className="min-h-[420px] border border-dashed bg-muted/20">
          <EmptyHeader>
            <EmptyMedia variant="icon"><RefreshCcw /></EmptyMedia>
            <EmptyTitle>分享链接暂时不可用</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => reloadPage()}>
              <RefreshCcw data-icon="inline-start" />
              重试
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-8"
    >
      <Header
        total={allShares.length}
        active={activeCount}
        canCreate={resumes.length > 0}
        onCreate={handleCreate}
      />
      <Toolbar
        keyword={searchKeyword}
        resumeIds={resumeFilters}
        status={statusFilter}
        resumes={resumes}
        onKeywordChange={setSearchKeyword}
        onResumeChange={setResumeFilters}
        onStatusChange={setStatusFilter}
      />

      <AnimatePresence mode="wait" initial={false}>
        {filteredShares.length === 0
          ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <EmptyState filtered={hasFilter} />
              </motion.div>
            )
          : (
              <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Grid
                  shares={filteredShares}
                  onPreview={handlePreview}
                  onSettings={handleOpenSettings}
                  onPushLatest={handlePushLatest}
                  onToggleActive={handleToggleActive}
                  onDelete={setDeleteShare}
                />
                <MobileList shares={filteredShares} onMore={setActionShare} />
              </motion.div>
            )}
      </AnimatePresence>

      <CreateDialog
        open={createDialogOpen}
        resumes={resumes}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreateShare}
      />

      <SettingsDialog
        share={settingsShare}
        busy={Boolean(settingsShare && mutatingId === settingsShare.id)}
        onOpenChange={open => !open && setSettingsShare(null)}
        onSave={handleSaveSettings}
      />

      <ActionDrawer
        share={actionShare}
        restoreFocusTo={actionTrigger}
        busy={Boolean(actionShare && mutatingId === actionShare.id)}
        onOpenChange={open => !open && setActionShare(null)}
        onPreview={() => actionShare && handlePreview(actionShare)}
        onSettings={() => actionShare && handleOpenSettings(actionShare)}
        onPushLatest={() => actionShare && handlePushLatest(actionShare)}
        onToggleActive={() => actionShare && handleToggleActive(actionShare)}
        onDelete={() => {
          setDeleteShare(actionShare)
          setActionShare(null)
        }}
      />

      <AlertDialog open={Boolean(deleteShare)} onOpenChange={open => !open && setDeleteShare(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>永久删除分享链接？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后链接立即失效，访问记录无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>永久删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
