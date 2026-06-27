// Session storage for the admin JWT. We use sessionStorage rather than a
// plain cookie because:
//   - The token must be readable by client-side JS so it can be attached as
//     `Authorization: Bearer <token>` on cross-origin fetches to the FastAPI
//     backend (a different origin from the admin panel, so cookies set by
//     the FastAPI backend wouldn't be sent automatically anyway).
//   - sessionStorage clears when the tab closes, which is the right
//     lifetime for an admin session — no "stay logged in forever" residue.
//
// The JWT itself is short-lived (12h, see backend JWT_EXPIRY_MINUTES) and
// signed by the backend, so even if it leaked it has a hard expiry and
// can't be forged into a different role.

const TOKEN_KEY = 'ca_token'

export function isAuthed(): boolean {
  if (typeof window === 'undefined') return false
  return !!window.sessionStorage.getItem(TOKEN_KEY)
}

export function setSession(token: string) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(TOKEN_KEY, token)
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.sessionStorage.getItem(TOKEN_KEY)
}

export function clearSession() {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(TOKEN_KEY)
}

/**
 * Wrapper around fetch() that automatically attaches the admin JWT as a
 * Bearer token. Use this instead of the raw fetch() for any call to the
 * FastAPI backend that hits an admin-only endpoint (products write,
 * coupons, orders, inbox, uploads/sign, shop-settings write).
 *
 * On a 401 response (token missing/expired/invalid), redirects to /login
 * so the admin re-authenticates rather than silently failing.
 */
export async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken()
  const headers = new Headers(init.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(url, { ...init, headers })

  if (res.status === 401 && typeof window !== 'undefined') {
    clearSession()
    window.location.href = '/login'
  }

  return res
}
