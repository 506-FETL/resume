import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import supabase from '@/lib/supabase/client'

/**
 * 当用户已经登录时，自动重定向到指定页面。
 *
 * Hook 挂载后会读取当前 Supabase session，
 * 如果发现已有登录用户，则立即调用路由导航跳转到 `redirect`。
 * 常用于登录页、注册页等“仅未登录用户可访问”的页面。
 *
 * @param redirect 登录用户需要被跳转到的目标路径，默认首页 `/`
 */
export default function useAlreadyLoggedRedirect(redirect: string = '/') {
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    const checkUser = async () => {
      const { data } = await supabase.auth.getSession()
      if (!cancelled && data.session) {
        navigate(redirect, { replace: true })
      }
    }
    checkUser()

    return () => {
      cancelled = true
    }
  }, [navigate, redirect])
}
