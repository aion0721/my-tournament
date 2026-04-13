export function createId(prefix: string) {
  const random = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}_${random}`
}

export function createShareToken() {
  return Math.random().toString(36).slice(2, 10).toUpperCase()
}

export function createInviteToken() {
  return Math.random().toString(36).slice(2, 12).toUpperCase()
}
