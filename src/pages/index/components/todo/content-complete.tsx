import { IconFolderCode } from '@tabler/icons-react'
import { ArrowRight, FileText } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Empty, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import supabase from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/supabase/user'

export default function CompletenessModule() {
  const navigate = useNavigate()
  const [items, setItems] = useState<string[]>()

  useEffect(() => {
    const fetchAtsTodos = async () => {
      const user = await getCurrentUser()
      if (!user)
        return

      const { data, error } = await supabase
        .from('ats')
        .select('todo_items')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (error)
        return

      setItems(data[0].todo_items)
    }

    fetchAtsTodos()
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2.5">
        <FileText className="size-3.5 text-amber-500" />
        <h4 className="font-medium text-xs">内容完善</h4>
      </div>
      <div className="bg-amber-50/80 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-100/80 dark:border-amber-900/20 flex-1 flex flex-col">
        <div className="flex-1">
          <p className="text-xs text-amber-700/90 dark:text-amber-400/90 mb-2">
            还差
            {' '}
            <span className="font-semibold">{items?.length || 0}</span>
            {' '}
            项优化
          </p>
          <div className="flex flex-wrap max-h-[22px] gap-1.5 overflow-hidden relative">
            {items?.map(item => (
              <span
                key={item}
                className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100/60 dark:bg-amber-900/30 text-amber-700/80 dark:text-amber-400/80 whitespace-nowrap"
              >
                {item}
              </span>
            ))}
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-linear-to-l from-amber-50 dark:from-[#1a120b] to-transparent pointer-events-none" />
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 mt-2.5 p-0 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 hover:bg-transparent justify-start"
          onClick={() => navigate('/optimize')}
        >
          去完善
          <ArrowRight className="size-3 ml-1" />
        </Button>
      </div>
    </div>
  )
}
