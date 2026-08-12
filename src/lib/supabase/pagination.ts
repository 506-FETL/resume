export async function collectPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = 200,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize <= 0)
    throw new Error('pageSize 必须是正整数')

  const items: T[] = []
  let from = 0

  while (true) {
    const page = await fetchPage(from, from + pageSize - 1)
    items.push(...page)
    if (page.length < pageSize)
      return items
    from += pageSize
  }
}
