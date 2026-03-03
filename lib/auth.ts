export const COOKIE = 'ca_session'

export function isAuthed(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split(';').some(c => c.trim().startsWith(`${COOKIE}=1`))
}

export function setSession() {
  const exp = new Date(Date.now() + 10 * 60 * 60 * 1000).toUTCString()
  document.cookie = `${COOKIE}=1; expires=${exp}; path=/`
}

export function clearSession() {
  document.cookie = `${COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`
}