'use client'

export function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'

  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))

  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${sizes[i]}`
}

export function setInputFiles(input: HTMLInputElement, files: File[]) {
  const dataTransfer = new DataTransfer()

  for (const file of files) {
    dataTransfer.items.add(file)
  }

  input.files = dataTransfer.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
}
