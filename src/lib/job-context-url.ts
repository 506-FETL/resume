export function jobContextUrl(
  path: string,
  jobId: string,
  extra: Record<string, string> = {},
) {
  const params = new URLSearchParams({ jobId, ...extra })

  return `${path}?${params.toString()}`
}
