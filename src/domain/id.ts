export function createId(prefix: string) {
  const random = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}_${random}`
}

export function normalizeHostIdentity(name: string) {
  return name.trim().toLocaleLowerCase()
}

export function createStableHostUserId(name: string) {
  const normalized = normalizeHostIdentity(name)
  let hash = 2166136261

  for (const char of normalized) {
    hash ^= char.codePointAt(0) ?? 0
    hash = Math.imul(hash, 16777619)
  }

  return `user_host_${(hash >>> 0).toString(36)}`
}

export function createShareToken() {
  return Math.random().toString(36).slice(2, 10).toUpperCase()
}

export function createInviteToken() {
  return Math.random().toString(36).slice(2, 12).toUpperCase()
}
