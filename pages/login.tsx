import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { isAuthed, setSession } from '@/lib/auth'

export default function Login() {
  const router = useRouter()
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [err,  setErr]  = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (isAuthed()) router.replace('/admin') }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const r = await fetch('/api/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, pass }),
    })
    if (r.ok) { setSession(); router.replace('/admin') }
    else      { setErr('Invalid credentials'); setBusy(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f7f7f7' }}>
      <div style={{ width: 320 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '.06em',
            textTransform: 'uppercase' }}>Cosmic Connect</div>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 3 }}>Admin Portal</div>
        </div>
        <div className="card">
          <div className="card-body">
            <form onSubmit={submit}>
              {err && <div className="alert alert-e">{err}</div>}
              <div className="fg">
                <label>Username</label>
                <input type="text" value={user} onChange={e => setUser(e.target.value)} autoFocus required />
              </div>
              <div className="fg" style={{ marginBottom: 18 }}>
                <label>Password</label>
                <input type="password" value={pass} onChange={e => setPass(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-p" disabled={busy}
                style={{ width: '100%', justifyContent: 'center' }}>
                {busy ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
        <p style={{ textAlign: 'center', color: '#ccc', fontSize: 11, marginTop: 12 }}>
          Credentials stored in admin/.env.local
        </p>
      </div>
    </div>
  )
}
