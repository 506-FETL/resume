import supabase from '../client'

export async function SignUpWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signUp({ email, password })

  if (error)
    throw error
}

export async function SignInWithEmailAndPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error)
    throw error

  return data.user
}

export async function SignOut() {
  const { error } = await supabase.auth.signOut()

  if (error)
    throw error
}
