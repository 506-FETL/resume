import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import supabase from '@/lib/supabase/client'

export default function useAlreadyLoggedRedirect(redirect: string = '/') {
  const navigate = useNavigate()

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        navigate(redirect)
      }
    }
    checkUser()
  }, [navigate, redirect])
}
