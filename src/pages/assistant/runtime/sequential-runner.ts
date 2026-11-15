/** 执行锁覆盖整段 Promise，包括取消后的已确认写入与消息落库。 */
export function createSequentialRunner() {
  let active: Promise<void> | null = null

  return {
    get busy() {
      return active !== null
    },
    start(work: () => Promise<void>): Promise<void> {
      if (active) return active

      const promise = Promise.resolve()
        .then(work)
        .finally(() => {
          if (active === promise) active = null
        })

      active = promise

      return promise
    },
    async settled() {
      await active
    },
  }
}
