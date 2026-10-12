import { useEffect, useMemo, useState } from 'react'
import { Truck, RefreshCw, AlertTriangle, ExternalLink } from 'lucide-react'
import { authedFetch } from '@/lib/auth'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface Carrier { key: string; label: string; region: 'domestic' | 'international'; url?: string; page?: string; auto?: boolean }

export const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending payment', failed: 'Payment failed', paid: 'Paid (new)', packed: 'Packed',
  dispatched: 'Dispatched', in_transit: 'In transit', out_for_delivery: 'Out for delivery',
  delivered: 'Delivered', returned: 'Returned (RTO)', cancelled: 'Cancelled', refunded: 'Refunded',
}
export const STATUS_COLOR: Record<string, string> = {
  pending: 'b-y', failed: 'b-r', paid: 'b-g', packed: 'b-u', dispatched: 'b-p', in_transit: 'b-p',
  out_for_delivery: 'b-p', delivered: 'b-g', returned: 'b-r', cancelled: 'b-r', refunded: 'b-u',
}
const SHIPPED = ['dispatched', 'in_transit', 'out_for_delivery', 'delivered', 'returned']
const EVENT_LABEL: Record<string, string> = { note: 'Note', dispute_opened: 'Marked as disputed', dispute_closed: 'Dispute resolved' }

let carrierCache: { carriers: Carrier[]; statuses: string[]; shiprocketConfigured: boolean } | null = null

function trackUrl(c: Carrier | undefined, id: string) {
  if (!c) return ''
  if (c.url && id.trim()) return c.url.replace('{id}', id.trim())
  return c.page || ''
}

/**
 * Delivery block in the admin order modal: status, courier, tracking ID/link,
 * dispute flag + notes, and history. Shiprocket shipments get a
 * "Refresh from Shiprocket" button (the backend also syncs them daily).
 */
export default function FulfillmentPanel({ order, onUpdated }: { order: any; onUpdated: (o: any) => void }) {
  const [meta, setMeta] = useState(carrierCache)
  const sh = order.shipment || {}
  const [status, setStatus]     = useState<string>(order.status)
  const [carrier, setCarrier]   = useState<string>(sh.carrier || '')
  const [trackingId, setTid]    = useState<string>(sh.trackingId || '')
  const [trackingUrl, setTurl]  = useState<string>(sh.trackingUrl || '')
  const [urlEdited, setEdited]  = useState<boolean>(!!sh.trackingUrl)
  const [note, setNote]         = useState('')
  const [disputed, setDisputed] = useState<boolean>(!!sh.disputed)
  const [disputeNotes, setDN]   = useState<string>(sh.disputeNotes || '')
  const [notify, setNotify]     = useState(true)
  const [busy, setBusy]         = useState(false)
  const [err, setErr]           = useState('')
  const [ok, setOk]             = useState('')

  useEffect(() => {
    if (carrierCache) return
    authedFetch(`${API}/orders/shipping/carriers`).then(r => r.json())
      .then(d => { carrierCache = d; setMeta(d) }).catch(() => setErr('Could not load the courier list.'))
  }, [])

  // Re-sync the form whenever a fresh order comes back from the server.
  useEffect(() => {
    const s = order.shipment || {}
    setStatus(order.status); setCarrier(s.carrier || ''); setTid(s.trackingId || '')
    setTurl(s.trackingUrl || ''); setEdited(!!s.trackingUrl); setDisputed(!!s.disputed)
    setDN(s.disputeNotes || ''); setNote('')
  }, [order])

  const carriers = meta?.carriers || []
  const current = useMemo(() => carriers.find(c => c.key === carrier), [carriers, carrier])

  // Auto-fill the tracking link from the courier + ID until the admin edits it.
  useEffect(() => { if (!urlEdited) setTurl(trackUrl(current, trackingId)) }, [current, trackingId, urlEdited])

  const locked = ['pending', 'failed'].includes(order.status)
  const closed = ['cancelled', 'refunded'].includes(order.status)
  const needsTracking = SHIPPED.includes(status)
  const statuses = meta?.statuses || ['paid', 'packed', 'dispatched', 'in_transit', 'out_for_delivery', 'delivered', 'returned']

  async function post(path: string, method: string, body?: object) {
    setBusy(true); setErr(''); setOk('')
    try {
      const res = await authedFetch(`${API}/orders/${order.id}${path}`, {
        method, headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(typeof data.detail === 'string' ? data.detail : 'Request failed'); return }
      onUpdated(data); setOk('Saved')
    } finally { setBusy(false) }
  }

  function save() {
    if (needsTracking && (!carrier || !trackingId.trim())) { setErr('Select the courier and enter the tracking ID first.'); return }
    const emailing = notify && status !== order.status && (
      (['dispatched', 'in_transit', 'out_for_delivery'].includes(status) && !sh.dispatchEmailAt) ||
      (status === 'delivered' && !sh.deliveredEmailAt))
    if (emailing && !confirm(`Save and email the customer that the order is ${status === 'delivered' ? 'delivered' : 'on its way'}?`)) return
    post('/fulfillment', 'PUT', {
      status: closed ? undefined : status, carrier, trackingId, trackingUrl, note: note.trim() || undefined,
      disputed, disputeNotes, notifyCustomer: notify,
    })
  }

  const label = (s: string) => STATUS_LABEL[s] || s
  const history: any[] = order.statusHistory || []

  return (
    <div style={{ borderTop: '1px solid #eee', paddingTop: 14, marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Truck size={14} style={{ color: '#999' }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.05em' }}>Delivery</span>
        {sh.disputed && <span className="b b-r"><AlertTriangle size={10} /> Disputed</span>}
        {current?.auto && sh.trackingId && !closed && (
          <button className="btn btn-s btn-sm" style={{ marginLeft: 'auto' }} disabled={busy || !meta?.shiprocketConfigured}
            title={meta?.shiprocketConfigured ? '' : 'Add the Shiprocket API user to the backend to enable this'}
            onClick={() => post('/fulfillment/sync', 'POST')}>
            <RefreshCw size={12} /> Refresh from Shiprocket
          </button>
        )}
      </div>

      {locked ? (
        <p style={{ fontSize: 12, color: '#888' }}>Available once the order is paid.</p>
      ) : (
        <>
          {current?.auto && (sh.courierStatus || sh.lastSyncedAt) && (
            <p style={{ fontSize: 12, color: '#666', margin: '0 0 10px' }}>
              Shiprocket says: <b>{sh.courierStatus || '—'}</b>
              {sh.lastSyncedAt && <span style={{ color: '#999' }}> · checked {new Date(sh.lastSyncedAt + 'Z').toLocaleString('en-IN')}</span>}
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="fg">
              <label>Status</label>
              <select value={status} disabled={closed} onChange={e => setStatus(e.target.value)}>
                {closed && <option value={order.status}>{label(order.status)}</option>}
                {statuses.map(s => <option key={s} value={s}>{label(s)}</option>)}
              </select>
            </div>
            <div className="fg">
              <label>Courier {needsTracking && '*'}</label>
              <select value={carrier} onChange={e => { setCarrier(e.target.value); setEdited(false) }}>
                <option value="">Select courier…</option>
                <optgroup label="Domestic">
                  {carriers.filter(c => c.region === 'domestic').map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </optgroup>
                <optgroup label="International">
                  {carriers.filter(c => c.region === 'international').map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </optgroup>
              </select>
            </div>
            <div className="fg">
              <label>Tracking ID / AWB {needsTracking && '*'}</label>
              <input value={trackingId} maxLength={60} onChange={e => setTid(e.target.value)} placeholder="e.g. 1234567890" />
            </div>
            <div className="fg">
              <label>Tracking link {trackingUrl && <a href={trackingUrl} target="_blank" rel="noreferrer"><ExternalLink size={10} /></a>}</label>
              <input value={trackingUrl} maxLength={500} placeholder="Filled automatically"
                onChange={e => { setTurl(e.target.value); setEdited(true) }} />
            </div>
          </div>
          {current && !current.url && current.page && (
            <p style={{ fontSize: 11, color: '#999', margin: '-6px 0 10px' }}>
              {current.label} has no direct tracking link — the customer will be sent to its tracking page with the ID.
            </p>
          )}

          <div className="fg">
            <label>Note (internal, saved in the history)</label>
            <input value={note} maxLength={500} onChange={e => setNote(e.target.value)} placeholder="Optional" />
          </div>

          <div className="fg" style={{ background: disputed ? '#fef2f2' : '#fafafa', padding: 10, borderRadius: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textTransform: 'none', fontSize: 13, color: '#333' }}>
              <input type="checkbox" checked={disputed} onChange={e => setDisputed(e.target.checked)} />
              Mark shipment as disputed
            </label>
            {(disputed || disputeNotes) && (
              <textarea rows={3} value={disputeNotes} maxLength={4000} style={{ marginTop: 8 }}
                onChange={e => setDN(e.target.value)} placeholder="Dispute notes — e.g. damaged parcel, claim ID, courier contact… (never shown to the customer)" />
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-p" disabled={busy || !meta} onClick={save}>{busy ? 'Saving…' : 'Save delivery details'}</button>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666', cursor: 'pointer' }}>
              <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} />
              Email the customer when dispatched / delivered
            </label>
            {ok && !err && <span style={{ fontSize: 12, color: '#16a34a' }}>{ok}</span>}
          </div>
          {err && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{err}</p>}

          {history.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>History</div>
              {[...history].reverse().map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12, padding: '3px 0', alignItems: 'baseline' }}>
                  <span style={{ color: '#999', width: 132, flexShrink: 0 }}>{h.at ? new Date(h.at + 'Z').toLocaleString('en-IN') : ''}</span>
                  <span style={{ fontWeight: 600 }}>{h.event ? EVENT_LABEL[h.event] || h.event : label(h.status)}</span>
                  {h.source === 'shiprocket' && <span className="b b-n">auto</span>}
                  {h.note && <span style={{ color: '#666' }}>{h.note}</span>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
