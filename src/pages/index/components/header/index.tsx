import type { MouseEventHandler } from 'react'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import useCurrentUser from '@/hooks/use-current-user'

interface HeaderProps {
  focus?: string
  onCreate: MouseEventHandler<HTMLButtonElement>
}

function Header({ focus, onCreate }: HeaderProps) {
  const [greeting, setGreeting] = useState('')
  const auth = useCurrentUser()

  useEffect(() => {
    const hour = new Date().getHours()

    if (hour < 5)
      setGreeting('晚上好')
    else if (hour < 11)
      setGreeting('早上好')
    else if (hour < 13)
      setGreeting('中午好')
    else if (hour < 18)
      setGreeting('下午好')
    else
      setGreeting('晚上好')
  }, [])

  return (
    <PageHeader title={`欢迎回来${auth?.user_metadata.full_name ? `，${auth.user_metadata.full_name}` : ''}`} description={focus || greeting} actions={<Button aria-label="打开创建简历表单" onClick={onCreate}>创建简历</Button>} />
  )
}

export default Header
