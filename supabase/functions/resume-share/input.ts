export async function readShareRequest(req: Request) {
  let operation = 'share_access'

  // ============ 匿名读取：GET ?token / POST { token, password }（读取意图） ============
  // POST 且带 op 字段 → owner 写入；否则视为访问读取。
  const url = new URL(req.url)
  let token = url.searchParams.get('token') ?? ''
  let password: string | null = null
  let passwordProvided = false
  let op: string | null = null
  let shareId: string | null = null
  let label: string | null = null
  let expiresAt: string | null = null
  let allowComments: boolean | undefined
  let refreshOnly = false
  let accessToken: string | null = null
  let knownContentRevision: string | null = null
  let settingsBody: Record<string, unknown> = {}

  if (req.method === 'POST') {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    settingsBody = body
    op = typeof body.op === 'string' ? body.op : null
    operation =
      op === 'set_password' || op === 'update_settings'
        ? 'owner_write'
        : 'share_access'

    if (typeof body.token === 'string') token = body.token
    if (Object.hasOwn(body, 'password')) {
      passwordProvided = true

      if (typeof body.password === 'string') password = body.password
    }
    if (typeof body.shareId === 'string') shareId = body.shareId
    if (typeof body.label === 'string') label = body.label
    if (typeof body.expiresAt === 'string') expiresAt = body.expiresAt
    if (typeof body.allowComments === 'boolean')
      allowComments = body.allowComments

    refreshOnly = body.refresh === true
    accessToken =
      typeof body.accessToken === 'string' && body.accessToken.length <= 4096
        ? body.accessToken
        : null
    knownContentRevision =
      typeof body.knownContentRevision === 'string'
        ? body.knownContentRevision
        : null
  }

  return {
    token,
    password,
    passwordProvided,
    op,
    shareId,
    label,
    expiresAt,
    allowComments,
    refreshOnly,
    accessToken,
    knownContentRevision,
    settingsBody,
    operation,
  }
}
