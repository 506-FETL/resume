import type { MouseEventHandler } from 'react'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import useUserStore from '@/store/user'

interface HeaderProps {
  focus?: string
  isGettingStarted?: boolean
  onCreate: MouseEventHandler<HTMLButtonElement>
}

function Header({ focus, onCreate, isGettingStarted }: HeaderProps) {
  const [greeting, setGreeting] = useState('')
  const auth = useUserStore((state) => state.currentUser)

  useEffect(() => {
    const hour = new Date().getHours()

    if (hour < 5) setGreeting('晚上好')
    else if (hour < 11) setGreeting('早上好')
    else if (hour < 13) setGreeting('中午好')
    else if (hour < 18) setGreeting('下午好')
    else setGreeting('晚上好')
  }, [])

  return (
    <PageHeader
      title={
        isGettingStarted
          ? '欢迎使用 GResume'
          : `欢迎回来${auth?.user_metadata.full_name ? `，${auth.user_metadata.full_name}` : ''}`
      }
      description={
        focus || (isGettingStarted ? '在这里编辑和导出你的简历。' : greeting)
      }
      actions={
        <Button aria-label='打开创建简历表单' onClick={onCreate}>
          创建简历
        </Button>
      }
    />
  )
}

export default Header
