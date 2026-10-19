export const AUTH_STORAGE_KEY = 'sultan-admin-authenticated'
export const SESSION_EXPIRED_EVENT = 'sultan-session-expired'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export function readAdminSession() {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    const session: unknown = raw ? JSON.parse(raw) : null
    return typeof session === 'object' && session !== null
      && 'expiresAt' in session && typeof session.expiresAt === 'number'
      && Number.isFinite(session.expiresAt) && session.expiresAt > Date.now()
  } catch {
    return false
  }
}

export function startAdminSession() {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ expiresAt: Date.now() + SESSION_TTL_MS }))
}

export function clearAdminSession() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
}

export function expireAdminSession() {
  clearAdminSession()
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
}
