export interface RemoteFieldUpdate {
  path: string
  value: unknown
}

export type RemoteFieldArrayOperation
  = | { type: 'append', path: string, value: unknown }
    | { type: 'remove', path: string, index: number }

export interface RemoteFormSyncPlan {
  fieldUpdates: RemoteFieldUpdate[]
  fieldArrayOperations: RemoteFieldArrayOperation[]
}

export interface RemoteFormWriter {
  setValue: (
    path: string,
    value: unknown,
    options: {
      shouldDirty: false
      shouldTouch: false
      shouldValidate: false
    },
  ) => unknown
}

export interface RemoteFieldArrayAdapter {
  append: (value: unknown, options: { shouldFocus: false }) => unknown
  remove: (index: number) => unknown
}

export type RemoteFieldArrayAdapters = Record<string, RemoteFieldArrayAdapter>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function joinPath(parent: string, child: string | number) {
  return parent ? `${parent}.${child}` : String(child)
}

export function planRemoteFormSync(
  currentValues: unknown,
  remoteValues: unknown,
  fieldArrayPaths: readonly string[] = [],
): RemoteFormSyncPlan {
  const fieldUpdates: RemoteFieldUpdate[] = []
  const fieldArrayOperations: RemoteFieldArrayOperation[] = []
  const fieldArrays = new Set(fieldArrayPaths)

  function visit(current: unknown, remote: unknown, path: string) {
    if (Object.is(current, remote)) {
      return
    }

    if (Array.isArray(current) && Array.isArray(remote)) {
      if (fieldArrays.has(path)) {
        const retainedLength = Math.min(current.length, remote.length)

        for (let index = 0; index < retainedLength; index += 1) {
          visit(current[index], remote[index], joinPath(path, index))
        }

        for (let index = current.length; index < remote.length; index += 1) {
          fieldArrayOperations.push({
            type: 'append',
            path,
            value: remote[index],
          })
        }

        for (let index = current.length - 1; index >= remote.length; index -= 1) {
          fieldArrayOperations.push({
            type: 'remove',
            path,
            index,
          })
        }
        return
      }

      if (current.length !== remote.length) {
        fieldUpdates.push({ path, value: remote })
        return
      }

      remote.forEach((value, index) => {
        visit(current[index], value, joinPath(path, index))
      })
      return
    }

    if (isRecord(current) && isRecord(remote)) {
      const keys = new Set([...Object.keys(current), ...Object.keys(remote)])
      keys.forEach((key) => {
        visit(current[key], remote[key], joinPath(path, key))
      })
      return
    }

    fieldUpdates.push({ path, value: remote })
  }

  visit(currentValues, remoteValues, '')

  return {
    fieldUpdates,
    fieldArrayOperations,
  }
}

export function applyRemoteFormSyncPlan(
  plan: RemoteFormSyncPlan,
  form: RemoteFormWriter,
  fieldArrays: RemoteFieldArrayAdapters = {},
) {
  plan.fieldUpdates.forEach(({ path, value }) => {
    form.setValue(path, value, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    })
  })

  plan.fieldArrayOperations.forEach((operation) => {
    const adapter = fieldArrays[operation.path]
    if (!adapter) {
      throw new Error(`Missing remote field array adapter for "${operation.path}"`)
    }

    if (operation.type === 'append') {
      adapter.append(operation.value, { shouldFocus: false })
      return
    }

    adapter.remove(operation.index)
  })
}
