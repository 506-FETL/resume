import { useEffect, useState } from 'react'
import useCurrentUser from '@/hooks/use-current-user'

function Header() {
  const [greeting, setGreeting] = useState('')
  const auth = useCurrentUser()

  useEffect(() => {
    const hour = new Date().getHours()

    if (hour < 5)
      setGreeting('夜深了，注意休息')
    else if (hour < 11)
      setGreeting('早上好，开启美好的一天')
    else if (hour < 13)
      setGreeting('中午好，记得按时吃饭')
    else if (hour < 18)
      setGreeting('下午好，继续加油')
    else
      setGreeting('晚上好，享受闲暇时光')
  }, [])

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="space-y-1.5">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight bg-clip-text text-transparent bg-linear-to-r from-primary to-primary/70">
          欢迎回来
          {auth?.user_metadata.full_name ? `, ${auth.user_metadata.full_name}` : ''}
        </h1>
        <p className="text-muted-foreground text-sm">
          {greeting}
        </p>
      </div>
    </div>
  )
}

export default Header
