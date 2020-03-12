/**
 * Get a nested object item using 'dot notation'.
 */
export function retrieve<T = any>(obj: object, key: string): T | undefined {
  let result: any = obj
  if (key.length === 0) {
    return result
  }

  const path = key.split(".")
  for (const k of path) {
    if (!isObject(result)) {
      break
    }
    result = result[k]
  }

  return result
}

/**
 * Set a nested object value using 'dot notation'.
 */
export function insert<T = any>(obj: object, key: string, value: any): T {
  const result = {...obj} as T

  if (key.length === 0) {
    return result
  }

  const path = key.split(".")
  const length = path.length
  let current: any = result

  for (let i = 0; i < length; i += 1) {
    const k = path[i]

    // Set the nested value if we're at the last iteration.
    if (i === length - 1) {
      current[k] = value
      break
    }

    // Otherwise make sure that the value under the current
    // key is an object and continue onwards.
    if (!isObject(current[k])) {
      current[k] = {}
    }
    current = current[k]
  }

  return result
}

export function isObject<T extends object = any>(value: any): value is T {
  return typeof value === "object" && value !== null
}
