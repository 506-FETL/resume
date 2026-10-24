import * as React from 'react'

import { CloudUploadIcon, FileCornerIcon, FileIcon } from './icons'

export const DropZoneContent: React.FC<{ maxSize: number; limit: number }> = ({
  maxSize,
  limit,
}) => (
  <>
    <div className='tiptap-image-upload-dropzone'>
      <FileIcon />
      <FileCornerIcon />
      <div className='tiptap-image-upload-icon-container'>
        <CloudUploadIcon />
      </div>
    </div>

    <div className='tiptap-image-upload-content'>
      <span className='tiptap-image-upload-text'>
        <em>点击上传</em> 或拖放图片文件到此处
      </span>
      <span className='tiptap-image-upload-subtext'>
        最多 {limit} 个文件, 每个 {maxSize / 1024 / 1024} MB
      </span>
    </div>
  </>
)
