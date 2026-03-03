import { useState } from 'react'
import Shell from '@/components/Shell'

export default function SettingsPage() {
  const [cur,  setCur]  = useState('')
  const [nxt,  setNxt]  = useState('')
  const [conf, setConf] = useState('')
  const [msg,  setMsg]  = useState<{type:'s'|'e';text:string}|null>(null)
  const [busy, setBusy] = useState(false)

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (nxt !== conf) { setMsg({ type: 'e', text: 'New passwords do not match' }); return }
    if (nxt.length < 6) { setMsg({ type: 'e', text: 'Password must be at least 6 characters' }); return }
    setBusy(true); setMsg(null)

    // Verify current password first
    const r = await fetch('/api/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: process.env.NEXT_PUBLIC_ADMIN_USER || 'admin', pass: cur }),
    })

    if (!r.ok) { setMsg({ type: 'e', text: 'Current password is incorrect' }); setBusy(false); return }

    // Can't change .env at runtime — instruct user to update manually
    setMsg({ type: 's', text: `Password verified. To set your new password, update ADMIN_PASSWORD=${nxt} in admin/.env.local and restart the admin server.` })
    setCur(''); setNxt(''); setConf('')
    setBusy(false)
  }

  return (
    <Shell title="Settings">
      <div className="ph"><div><h1>Settings</h1></div></div>

      <div style={{ maxWidth: 480 }}>
        <div className="card">
          <div className="card-head"><h2>Change Password</h2></div>
          <div className="card-body">
            <form onSubmit={changePassword}>
              {msg && <div className={`alert ${msg.type === 'e' ? 'alert-e' : 'alert-s'}`}>{msg.text}</div>}
              <div className="fg">
                <label>Current Password</label>
                <input type="password" value={cur} onChange={e => setCur(e.target.value)} required />
              </div>
              <div className="fg">
                <label>New Password</label>
                <input type="password" value={nxt} onChange={e => setNxt(e.target.value)} required />
              </div>
              <div className="fg" style={{ marginBottom: 18 }}>
                <label>Confirm New Password</label>
                <input type="password" value={conf} onChange={e => setConf(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-p" disabled={busy}>
                {busy ? 'Checking…' : 'Change Password'}
              </button>
            </form>
          </div>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-head"><h2>Environment Info</h2></div>
          <div className="card-body">
            <table>
              <tbody>
                {[
                  ['Admin Username', process.env.NEXT_PUBLIC_ADMIN_USER || 'admin'],
                  ['Backend API',    process.env.NEXT_PUBLIC_API_URL    || 'http://localhost:8000'],
                  ['Admin Port',     '3001'],
                  ['Frontend Port',  '3000'],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ color: '#aaa', paddingRight: 16, width: 160 }}>{k}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  )
}
