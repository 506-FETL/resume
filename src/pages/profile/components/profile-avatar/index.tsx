import type { ChangeEvent } from 'react'
import type { AvatarCropShape, AvatarPercentCrop } from '../../types'
import { Camera } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CurrentUserAvatar } from '@/components/current-user-avatar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { createCroppedImageFile } from '@/lib/crop-image'
import { changeAvatar } from '@/lib/supabase/user'
import { AvatarCropDialog } from '../avatar-crop-dialog'

interface PendingAvatarSelection {
  name: string
  src: string
  type: string
}

export function ProfileAvatar() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [cropOpen, setCropOpen] = useState(false)
  const [pendingAvatar, setPendingAvatar] = useState<PendingAvatarSelection | null>(null)

  useEffect(() => {
    return () => {
      if (pendingAvatar?.src)
        URL.revokeObjectURL(pendingAvatar.src)
    }
  }, [pendingAvatar])

  const clearPendingAvatar = () => {
    if (pendingAvatar?.src)
      URL.revokeObjectURL(pendingAvatar.src)

    setPendingAvatar(null)
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      e.target.value = ''
      return
    }

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件')
      e.target.value = ''
      return
    }

    // 验证文件大小（最大 5MB）
    if (file.size > 5 * 1024 * 1024) {
      toast.error('图片大小不能超过 5MB')
      e.target.value = ''
      return
    }

    clearPendingAvatar()
    setPendingAvatar({
      name: file.name,
      src: URL.createObjectURL(file),
      type: file.type,
    })
    setCropOpen(true)
    e.target.value = ''
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleCropOpenChange = (open: boolean) => {
    if (uploading)
      return

    setCropOpen(open)
    if (!open)
      clearPendingAvatar()
  }

  const handleCropConfirm = async (crop: AvatarPercentCrop, shape: AvatarCropShape) => {
    if (!pendingAvatar)
      return

    setUploading(true)
    try {
      const croppedFile = await createCroppedImageFile({
        imageSrc: pendingAvatar.src,
        crop,
        fileName: pendingAvatar.name,
        shape,
        mimeType: pendingAvatar.type,
      })

      await changeAvatar(croppedFile)
      toast.success('头像更新成功')
      setCropOpen(false)
      clearPendingAvatar()
    }
    catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error(`头像上传失败，请稍后重试：${message}`)
    }
    finally {
      setUploading(false)
    }
  }

  return (
    <>
      <div className="relative transition-all duration-300">
        <CurrentUserAvatar className="size-24" />
        <Button
          onClick={handleAvatarClick}
          disabled={uploading}
          size="icon"
          className="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full hover:cursor-pointer hover:shadow-md"
          title="更换头像"
        >
          {uploading ? <Spinner className="size-4" /> : <Camera className="size-4" />}
        </Button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      </div>

      <AvatarCropDialog
        open={cropOpen}
        image={pendingAvatar?.src ?? null}
        submitting={uploading}
        onOpenChange={handleCropOpenChange}
        onConfirm={handleCropConfirm}
      />
    </>
  )
}
