import { ResumeNotFoundError } from '@/lib/resume-id'
import supabase from '../client'

export async function readOwnedResumeRow(
  resumeId: string,
  owner: string,
  selector: string,
  signal?: AbortSignal,
) {
  const query = supabase
    .from('resume_config')
    .select(selector)
    .eq('user_id', owner)
    .eq('resume_id', resumeId)

  if (signal) query.abortSignal(signal)

  const { data, error } = await query
    .maybeSingle()
    .overrideTypes<Record<string, unknown>, { merge: false }>()

  if (error) throw error
  if (!data) throw new ResumeNotFoundError()

  return data
}
