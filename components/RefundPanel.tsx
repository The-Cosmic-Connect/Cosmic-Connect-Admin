import { useEffect, useState } from 'react'
import { RotateCcw, RefreshCw } from 'lucide-react'
import { authedFetch } from '@/lib/auth'

export interface RefundEntry {
  refundId: string; amount: number; status: string; note?: string; createdAt?: string
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const STATUS_CLASS: Record<string, string> = {
  SUCCESS: 'b-g', PENDING: 'b-y', ONHOLD: 'b-y', CANCELLED: 'b-r', FAILED: 'b-r',
}

/**
 * "Initiate refund" block for a cancelled order / booking.
 *
 * - The button is only enabled when `enabled` is true (the item is cancelled,
 *   was paid through Cashfree, and something is still refundable).
 * - The amount box is pre-filled with the remaining refundable balance and can
 *   be lowered for a partial refund.
 * - `endpoint` is e.g. `${API}/bookings/<id>` or `${API}/orders/<id>`; this calls
 *   `<endpoint>/refund` and `<endpoint>/refund/sync`. `onUpdated` receives the
 *   refreshed record the backend returns.
 */
export default function RefundPanel({
  endpoint, paid, refunds, enabled, disabledReason, defaultNote, onUpdated,
}: {
  endpoint: string
  paid: number
  refunds?: RefundEntry[]
  enabled: boolean
  disabledReason: string
  defaultNote: string
  onUpdated: (record: any) => void
}) {
  const list = refunds || []
  const counted = list.filter(r => r.status !== 'CANCELLED' && r.status !== 'FAILED')
    .reduce((s, r) => s + r.amount, 0)
  const left = Math.max(0, Math.round((paid - counted) * 100) / 100)

  const [open, setOpen]     = useState(false)
  const [amount, setAmount] = useState(String(left))
  const [note, setNote]     = useState(defaultNote)
  const [busy, setBusy]     = useState(false)
  const [err, setErr]       = useState('')

  useEffect(() => { setAmount(String(left)) }, [left])

  const canRefund = enabled && left > 0
  const hasOpen   = list.some(r => r.status === 'PENDING' || r.status === 'ONHOLD')

  async function call(path: string, body?: object) {
    setBusy(true); setErr('')
    try {
      const res = await authedFetch(`${endpoint}${path}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(typeof data.detail === 'string' ? data.detail : 'Request failed'); return false }
      onUpdated(data)
      return true
    } finally { setBusy(false) }
  }

  async function submit() {
    const amt = Number(amount)
    if (!(amt > 0) || amt > left) { setErr(`Enter an amount between ₹0.01 and ₹${left.toLocaleString('en-IN')}.`); return }
    if (!confirm(`Refund ₹${amt.toLocaleString('en-IN')} to the customer's original payment method via Cashfree?\n\nThis cannot be undone.`)) return
    if (await call('/refund', { amount: amt, note })) setOpen(false)
  }

  return (
    <div style={{ borderTop: '1px solid #eee', paddingTop: 14, marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.05em' }}>Refund</span>
        {hasOpen && (
          <button className="btn btn-s btn-sm" disabled={busy} onClick={() => call('/refund/sync')} style={{ marginLeft: 'auto' }}>
            <RefreshCw size={12} /> Refresh status
          </button>
        )}
      </div>

      {list.length > 0 && (
        <div style={{ marginBottom: 10, fontSize: 12 }}>
          {list.map(r => (
            <div key={r.refundId} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '4px 0' }}>
              <span style={{ fontWeight: 600 }}>₹{r.amount.toLocaleString('en-IN')}</span>
              <span className={`b ${STATUS_CLASS[r.status] || 'b-n'}`}>{r.status}</span>
              <span style={{ color: '#999' }}>{r.createdAt ? new Date(r.createdAt + 'Z').toLocaleString('en-IN') : ''}</span>
            </div>
          ))}
        </div>
      )}

      {!open ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-p" disabled={!canRefund || busy} onClick={() => { setErr(''); setOpen(true) }}
            title={canRefund ? '' : disabledReason}>
            <RotateCcw size={14} /> Initiate Refund
          </button>
          <span style={{ fontSize: 12, color: '#888' }}>
            {canRefund ? `Refundable: ₹${left.toLocaleString('en-IN')}`
              : (enabled && left <= 0 ? 'Fully refunded' : disabledReason)}
          </span>
        </div>
      ) : (
        <div>
          <div className="fg">
            <label>Refund amount (₹) — up to ₹{left.toLocaleString('en-IN')}</label>
            <input type="number" min={0.01} max={left} step="0.01" value={amount}
              onChange={e => setAmount(e.target.value)} />
          </div>
          <div className="fg">
            <label>Note (kept with the refund)</label>
            <input value={note} onChange={e => setNote(e.target.value)} maxLength={100} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-p" disabled={busy} onClick={submit}>{busy ? 'Processing…' : 'Confirm refund'}</button>
            <button className="btn btn-s" disabled={busy} onClick={() => setOpen(false)}>Back</button>
          </div>
        </div>
      )}

      {err && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{err}</p>}
    </div>
  )
}
