import useUserStore from '@/store/user'
import useResumeListStore from './index'

export function openLibraryVisit() {
  function load() {
    if (useUserStore.getState().authStatus !== 'unknown')
      useResumeListStore.getState().refreshLibrary()
  }

  const unsubscribe = useUserStore.subscribe((state, previous) => {
    if (
      state.authStatus !== previous.authStatus ||
      state.currentUser?.id !== previous.currentUser?.id
    )
      load()
  })

  load()

  return () => {
    unsubscribe()
    useResumeListStore.getState().cancelLibraryLoad()
  }
}
