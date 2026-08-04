import { PanelLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { listConversations } from '@/lib/supabase/ai'
import { getErrorMessage } from '@/utils'
import Composer from './components/composer'
import ConversationList from './components/conversation-list'
import MessageList from './components/message-list'
import { useFillHeight } from './hooks/use-fill-height'
import useAssistantStore from './store'

export default function Assistant() {
  const isMobile = useIsMobile()
  const [sheetOpen, setSheetOpen] = useState(false)
  const { ref, height } = useFillHeight()

  useEffect(() => {
    const load = async () => {
      useAssistantStore.getState().setLoadingConversations(true)
      try {
        const list = await listConversations()
        useAssistantStore.getState().setConversations(list)
      }
      catch (error) {
        toast.error('加载会话失败', { description: getErrorMessage(error) })
      }
      finally {
        useAssistantStore.getState().setLoadingConversations(false)
      }
    }
    load()
  }, [])

  return (
    <div
      ref={ref}
      style={{ height }}
      className="flex min-h-0 overflow-hidden rounded-xl border bg-card/30"
    >
      {/* 会话列表侧栏（桌面常驻，自身固定不滚，内部列表滚） */}
      {!isMobile && (
        <aside className="flex w-64 shrink-0 flex-col border-r bg-background/60 p-3">
          <ConversationList />
        </aside>
      )}

      {/* 对话区 */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* 移动端顶栏：唤起会话抽屉 */}
        {isMobile && (
          <div className="flex items-center gap-2 border-b p-2">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="会话列表">
                  <PanelLeft className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-3">
                <SheetTitle className="sr-only">会话列表</SheetTitle>
                <ConversationList onNavigate={() => setSheetOpen(false)} />
              </SheetContent>
            </Sheet>
            <span className="text-sm font-medium">AI 助手</span>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          <MessageList />
        </div>

        <div className="shrink-0 border-t bg-background/60 py-3">
          <Composer />
        </div>
      </div>
    </div>
  )
}
