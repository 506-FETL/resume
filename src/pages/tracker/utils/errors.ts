export function getTrackerLoadErrorMeta(error: unknown) {
  let message = '加载失败'
  let description = ''

  if (error instanceof Error) {
    if (
      error.message.includes('未登陆') ||
      error.message.includes('not authenticated')
    ) {
      message = '请先登录'
      description = '需要登录后才能查看职位追踪'
    } else if (
      error.message.includes('network') ||
      error.message.includes('fetch')
    ) {
      message = '网络连接失败'
      description = '请检查网络连接后重试'
    } else if (
      error.message.includes('permission') ||
      error.message.includes('policy')
    ) {
      message = '权限不足'
      description = '无法访问职位数据，请联系管理员'
    } else if (
      error.message.includes('database') ||
      error.message.includes('relation')
    ) {
      message = '数据库错误'
      description = '数据表可能不存在或结构异常'
    } else {
      description = error.message
    }
  }

  return { message, description }
}

export function getTrackerErrorMessage(error: unknown, fallback = '未知错误') {
  return error instanceof Error ? error.message : fallback
}
