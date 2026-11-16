'use client'

import {
  FileVideoIcon,
  FileAudioIcon,
  FileTextIcon,
  FileCodeIcon,
  FileArchiveIcon,
  FileCogIcon,
  FileIcon,
} from 'lucide-react'

export function getFileIcon(file: File) {
  const type = file.type
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''

  if (type.startsWith('video/')) {
    return <FileVideoIcon />
  }

  if (type.startsWith('audio/')) {
    return <FileAudioIcon />
  }

  if (
    type.startsWith('text/') ||
    ['txt', 'md', 'rtf', 'pdf'].includes(extension)
  ) {
    return <FileTextIcon />
  }

  if (
    [
      'html',
      'css',
      'js',
      'jsx',
      'ts',
      'tsx',
      'json',
      'xml',
      'php',
      'py',
      'rb',
      'java',
      'c',
      'cpp',
      'cs',
    ].includes(extension)
  ) {
    return <FileCodeIcon />
  }

  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(extension)) {
    return <FileArchiveIcon />
  }

  if (
    ['exe', 'msi', 'app', 'apk', 'deb', 'rpm'].includes(extension) ||
    type.startsWith('application/')
  ) {
    return <FileCogIcon />
  }

  return <FileIcon />
}
