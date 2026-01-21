import { useEffect, useState } from 'react'
import supabase from '@/lib/supabase/client'

export function useCurrentUserImage() {
  const [image, setImage] = useState<string | undefined>(undefined)

  useEffect(() => {
    const fetchUserImage = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        console.error(error)
      }

      setImage(data.session?.user.user_metadata.avatar_url)
    }
    fetchUserImage()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setImage(session?.user.user_metadata.avatar_url)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return image
}
