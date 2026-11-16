import {
  FileCode2,
  FileText,
  FileType,
  NotebookPen,
  Image,
  Sheet,
} from 'lucide-react'

export const EXPERIENCE_DESCRIPTION =
  '保存周报、项目记录和旧简历，写简历时随时取用。'

export const EXPERIENCE_GRID_CLASS =
  'grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-4'

export const EXPERIENCE_SOURCE_APPEARANCE = {
  image: {
    label: '图片',
    icon: Image,
    className: 'bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300',
  },
  spreadsheet: {
    label: '表格',
    icon: Sheet,
    className:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300',
  },
  pdf: {
    label: 'PDF',
    icon: FileText,
    className:
      'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300',
  },
  docx: {
    label: 'DOCX',
    icon: FileType,
    className:
      'bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300',
  },
  text: {
    label: 'TXT',
    icon: FileText,
    className: 'bg-muted text-muted-foreground',
  },
  markdown: {
    label: 'Markdown',
    icon: FileCode2,
    className:
      'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300',
  },
  paste: {
    label: '文字',
    icon: NotebookPen,
    className:
      'bg-violet-50 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300',
  },
}
