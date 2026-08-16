const ALERT_CODE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/u

export interface BackendAlert {
  code: string
  severity: 'warning' | 'high' | 'critical'
  details: Record<string, number | boolean>
}

export interface BackendOpsSnapshot {
  generatedAt: string
  windowMinutes: number
  alerts: BackendAlert[]
  notificationCodes: string[]
  summary: Record<string, number>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function readBackendOpsSnapshot(
  value: unknown,
): BackendOpsSnapshot | null {
  if (
    !isRecord(value)
    || typeof value.generatedAt !== 'string'
    || value.generatedAt.length > 64
  ) {
    return null
  }
  if (
    !Number.isInteger(value.windowMinutes)
    || Number(value.windowMinutes) < 5
    || Number(value.windowMinutes) > 1440
  ) {
    return null
  }
  if (
    !Array.isArray(value.alerts)
    || !Array.isArray(value.notificationCodes)
    || !isRecord(value.summary)
  ) {
    return null
  }
  if (
    value.alerts.length > 32
    || value.notificationCodes.length > 32
    || Object.keys(value.summary).length > 64
  ) {
    return null
  }
  if (!Number.isFinite(Date.parse(value.generatedAt)))
    return null

  const alerts: BackendAlert[] = []
  const alertCodes = new Set<string>()
  for (const candidate of value.alerts) {
    if (
      !isRecord(candidate)
      || typeof candidate.code !== 'string'
      || !ALERT_CODE_PATTERN.test(candidate.code)
      || !['warning', 'high', 'critical'].includes(String(candidate.severity))
      || alertCodes.has(candidate.code)
    ) {
      return null
    }
    if (Object.keys(candidate).length > 34)
      return null
    const details: Record<string, number | boolean> = {}
    for (const [key, detail] of Object.entries(candidate)) {
      if (key === 'code' || key === 'severity')
        continue
      if (!/^[a-z][a-zA-Z0-9]{0,63}$/u.test(key))
        return null
      if (typeof detail === 'boolean') {
        details[key] = detail
      }
      else if (
        typeof detail === 'number'
        && Number.isFinite(detail)
        && detail >= 0
      ) {
        details[key] = detail
      }
      else {
        return null
      }
    }
    alertCodes.add(candidate.code)
    alerts.push({
      code: candidate.code,
      severity: candidate.severity as BackendAlert['severity'],
      details,
    })
  }

  const notificationCodes: string[] = []
  for (const code of value.notificationCodes) {
    if (
      typeof code !== 'string'
      || !alertCodes.has(code)
      || notificationCodes.includes(code)
    ) {
      return null
    }
    notificationCodes.push(code)
  }

  const summary: Record<string, number> = {}
  for (const [key, metric] of Object.entries(value.summary)) {
    if (
      !/^[a-z][a-zA-Z0-9]{0,63}$/u.test(key)
      || typeof metric !== 'number'
      || !Number.isFinite(metric)
      || metric < 0
    ) {
      return null
    }
    summary[key] = metric
  }

  return {
    generatedAt: value.generatedAt,
    windowMinutes: Number(value.windowMinutes),
    alerts,
    notificationCodes,
    summary,
  }
}

export function buildBackendAlertWebhook(snapshot: BackendOpsSnapshot) {
  const due = new Set(snapshot.notificationCodes)
  return {
    event: 'resume_backend_alert',
    generatedAt: snapshot.generatedAt,
    windowMinutes: snapshot.windowMinutes,
    alerts: snapshot.alerts.filter(alert => due.has(alert.code)),
    summary: snapshot.summary,
  }
}

export function readHttpsWebhookUrl(value: string | undefined) {
  if (!value)
    return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.hash)
      return null
    return url.toString()
  }
  catch {
    return null
  }
}
