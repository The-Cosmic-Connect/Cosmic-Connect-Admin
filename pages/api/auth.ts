import type { NextApiRequest, NextApiResponse } from 'next'

const BACKEND_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/**
 * Admin login. Two steps:
 *   1. Check username/password against env vars (unchanged from before).
 *   2. On success, request a signed JWT from the FastAPI backend using
 *      ADMIN_SHARED_SECRET — a server-to-server secret that never reaches
 *      the browser. The JWT is what actually authorizes calls to the
 *      backend's admin-only endpoints (products write, coupons, orders,
 *      inbox, uploads/sign, shop-settings write).
 *
 * The browser never sees ADMIN_SHARED_SECRET; it only receives the JWT,
 * which we set as an httpOnly cookie so client-side JS can't read it either
 * (mitigates XSS token theft). The admin's fetch calls to the FastAPI
 * backend then need to read this cookie server-side... but since this is a
 * SPA calling a *different* origin (the FastAPI backend), httpOnly cookies
 * won't be sent cross-origin automatically. So we ALSO return the token in
 * the JSON response for the browser to hold in memory/sessionStorage and
 * attach as an Authorization header on each request. See lib/auth.ts.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { user, pass } = req.body || {}
  const expectedUser = process.env.ADMIN_USER || 'admin'
  const expectedPass = process.env.ADMIN_PASSWORD

  if (!expectedPass) {
    // Fail loudly if the operator forgot to configure this in production,
    // rather than silently falling back to a guessable default.
    console.error('ADMIN_PASSWORD is not set in the admin panel environment')
    return res.status(500).json({ ok: false, error: 'Server misconfigured' })
  }

  if (user !== expectedUser || pass !== expectedPass) {
    return res.status(401).json({ ok: false })
  }

  const sharedSecret = process.env.ADMIN_SHARED_SECRET
  if (!sharedSecret) {
    console.error('ADMIN_SHARED_SECRET is not set in the admin panel environment')
    return res.status(500).json({ ok: false, error: 'Server misconfigured' })
  }

  try {
    const tokenRes = await fetch(`${BACKEND_URL}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sharedSecret }),
    })
    if (!tokenRes.ok) {
      const text = await tokenRes.text()
      console.error('Backend token issuance failed:', text)
      return res.status(502).json({ ok: false, error: 'Could not obtain session token' })
    }
    const { token } = await tokenRes.json()
    return res.status(200).json({ ok: true, token })
  } catch (e) {
    console.error('Auth token request failed:', e)
    return res.status(502).json({ ok: false, error: 'Could not reach backend' })
  }
}
