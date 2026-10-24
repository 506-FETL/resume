import { useEffect } from 'react'
import useResumeStore from '@/store/resume/form'
import { useResumeReviewStore } from '../review-store'
import { useTemplateSwitchStore } from '../template-switch/store'

let activeSubscribers = 0

/** 挂载于编辑器常驻设置入口；订阅回调同步运行，阻止旧会话的应用与撤销。 */
export function useTemplateSwitchSession() {
  useEffect(() => {
    activeSubscribers += 1
    const synchronize = () =>
      useTemplateSwitchStore.getState().synchronizeSession()
    synchronize()
    const unsubscribeForm = useResumeStore.subscribe(synchronize)
    const unsubscribeReview = useResumeReviewStore.subscribe(synchronize)
    return () => {
      unsubscribeForm()
      unsubscribeReview()
      activeSubscribers -= 1
      // StrictMode 会在同一任务里重新挂载，真正离开编辑器才销毁会话记录。
      queueMicrotask(() => {
        if (activeSubscribers === 0)
          useTemplateSwitchStore.setState({
            sessionKey: null,
            open: false,
            selectedBinding: null,
            conflictBinding: null,
            undoRecord: null,
          })
      })
    }
  }, [])
}
