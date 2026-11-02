export function getResumeShareFunctionUrl(): URL {
  const url = new URL(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resume-share`,
  )

  // 分享读写包含多次数据库查询，默认与当前项目数据库在同一区域执行。
  const region =
    import.meta.env.VITE_RESUME_SHARE_FUNCTION_REGION ?? 'us-east-1'

  if (region !== 'auto') url.searchParams.set('forceFunctionRegion', region)

  return url
}
