import { preloadComponent } from './preload-component'

export const resumeLibraryPage = preloadComponent(
  () => import('@/pages/resume/components/library-page'),
)

let selected = false
let leave: (() => void) | undefined

export function isResumeLibrary(pathname: string) {
  return pathname.replace(/\/+$/, '') === '/resume'
}

export function selectResumeLibrary(active: boolean) {
  if (selected === active) return

  selected = active

  if (!active) {
    leave?.()
    leave = undefined

    return
  }

  import('@/pages/resume/store/visit')
    .then(({ openLibraryVisit }) => {
      if (selected && !leave) leave = openLibraryVisit()
    })
    .catch(() => {
      selected = false
    })
}
