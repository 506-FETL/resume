import * as React from 'react'

import { CloseIcon } from '@/components/tiptap-icons/close-icon'
import { Button } from '@/components/tiptap-ui-primitive/button'

import { CloudUploadIcon } from './icons'
import type { FileItem } from './types'

interface ImageUploadPreviewProps {
  fileItem: FileItem
  onRemove: () => void
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

export const ImageUploadPreview: React.FC<ImageUploadPreviewProps> = ({
  fileItem,
  onRemove,
}) => {
  return (
    <div className='tiptap-image-upload-preview'>
      {fileItem.status === 'uploading' && (
        <div
          className='tiptap-image-upload-progress'
          style={{ width: `${fileItem.progress}%` }}
        />
      )}

      <div className='tiptap-image-upload-preview-content'>
        <div className='tiptap-image-upload-file-info'>
          <div className='tiptap-image-upload-file-icon'>
            <CloudUploadIcon />
          </div>
          <div className='tiptap-image-upload-details'>
            <span className='tiptap-image-upload-text'>
              {fileItem.file.name}
            </span>
            <span className='tiptap-image-upload-subtext'>
              {formatFileSize(fileItem.file.size)}
            </span>
          </div>
        </div>
        <div className='tiptap-image-upload-actions'>
          {fileItem.status === 'uploading' && (
            <span className='tiptap-image-upload-progress-text'>
              {fileItem.progress}%
            </span>
          )}
          <Button
            type='button'
            data-style='ghost'
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
          >
            <CloseIcon className='tiptap-button-icon' />
          </Button>
        </div>
      </div>
    </div>
  )
}
