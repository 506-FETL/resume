import type { FunctionRegion } from '@supabase/supabase-js'

const regionOverrides = {
  'resume-share': import.meta.env.VITE_RESUME_SHARE_FUNCTION_REGION,
  'resume-comments': import.meta.env.VITE_RESUME_COMMENTS_FUNCTION_REGION,
  'job-submissions': import.meta.env.VITE_JOB_SUBMISSIONS_FUNCTION_REGION,
}

type DatabaseFunction = keyof typeof regionOverrides

export function getDatabaseFunctionRegion(
  name: DatabaseFunction,
): FunctionRegion {
  const region =
    regionOverrides[name] ??
    import.meta.env.VITE_SUPABASE_FUNCTION_REGION ??
    'us-east-1'

  return (region === 'auto' ? 'any' : region) as FunctionRegion
}

export function getDatabaseFunctionUrl(name: DatabaseFunction): URL {
  const url = new URL(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`,
  )

  const region = getDatabaseFunctionRegion(name)

  if (region !== 'any') url.searchParams.set('forceFunctionRegion', region)

  return url
}
