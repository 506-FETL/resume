import { useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface DeleteResumeDialogProps {
  resumeName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  onDeletedClose?: () => void
}

export default function DeleteResumeDialog({
  resumeName,
  open,
  onOpenChange,
  onConfirm,
  onDeletedClose,
}: DeleteResumeDialogProps) {
  const confirmedRef = useRef(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='max-h-[calc(100dvh-2rem)] overflow-y-auto'
        onOpenAutoFocus={() => {
          confirmedRef.current = false
        }}
        onCloseAutoFocus={(event) => {
          if (!confirmedRef.current || !onDeletedClose) return

          event.preventDefault()
          onDeletedClose()
        }}
      >
        <DialogHeader>
          <DialogTitle>确认删除简历?</DialogTitle>
          <DialogDescription>
            <Badge
              variant='secondary'
              className='max-w-full whitespace-normal wrap-anywhere'
            >
              {resumeName}
            </Badge>
            的所有数据将永久删除，无法恢复。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            variant='destructive'
            onClick={() => {
              confirmedRef.current = true
              onConfirm()
            }}
          >
            删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
