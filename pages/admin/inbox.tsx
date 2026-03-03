import { useEffect, useState, useCallback } from 'react'
import Shell from '@/components/Shell'
import { Mail, Calendar, BookOpen } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }
  catch { return iso }
}

// ── Generic detail modal ──────────────────────────────────────────────────────
function DetailModal({ item, onClose }: { item: any; onClose: () => void }) {
  if (!item) return null
  const skip = ['id', 'type', 'createdAt', 'pk', 'sk']
  const fields = Object.entries(item).filter(([k]) => !skip.includes(k))
  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-h">
          <h3>Details</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        <div className="modal-b">
          <table style={{ fontSize: 13 }}>
            <tbody>
              {fields.map(([k, v]) => (
                <tr key={k}>
                  <td style={{ paddingRight: 16, color: '#aaa', textTransform: 'capitalize',
                    whiteSpace: 'nowrap', verticalAlign: 'top', paddingBottom: 8 }}>
                    {k.replace(/([A-Z])/g, ' $1').trim()}
                  </td>
                  <td style={{ paddingBottom: 8, color: '#222', lineHeight: 1.6 }}>
                    {String(v || '—')}
                  </td>
                </tr>
              ))}
              <tr>
                <td style={{ color: '#aaa', paddingRight: 16 }}>Received</td>
                <td>{formatDate(item.createdAt)}</td>
              </tr>
            </tbody>
          </table>

          {/* Quick reply/WhatsApp buttons */}
          {item.email && (
            <div className="flex gap2" style={{ marginTop: 16 }}>
              <a href={`mailto:${item.email}`} className="btn btn-p btn-sm">Reply via Email</a>
              {item.phone && (
                <a href={`https://wa.me/${item.phone.replace(/\D/g,'')}`}
                  target="_blank" rel="noopener noreferrer" className="btn btn-s btn-sm">
                  WhatsApp
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Tab components ─────────────────────────────────────────────────────────────
function ItemList({ endpoint, cols }: { endpoint: string; cols: { key: string; label: string }[] }) {
  const [items,    setItems]    = useState<any[]>([])
  const [busy,     setBusy]     = useState(true)
  const [selected, setSelected] = useState<any>(null)

  useEffect(() => {
    setBusy(true)
    fetch(`${API}${endpoint}`)
      .then(r => r.json())
      .then(d => { setItems(Array.isArray(d) ? d : d.items || d.inquiries || d.messages || []); setBusy(false) })
      .catch(() => setBusy(false))
  }, [endpoint])

  if (busy) return <div className="empty">Loading…</div>
  if (items.length === 0) return <div className="empty">Nothing here yet.</div>

  return (
    <>
      <div className="card">
        <table>
          <thead>
            <tr>
              {cols.map(c => <th key={c.key}>{c.label}</th>)}
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id || i}>
                {cols.map(c => (
                  <td key={c.key}>
                    <span className="trunc">{String(item[c.key] || '—')}</span>
                  </td>
                ))}
                <td className="muted">{formatDate(item.createdAt)}</td>
                <td>
                  <button className="btn btn-s btn-sm" onClick={() => setSelected(item)}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && <DetailModal item={selected} onClose={() => setSelected(null)} />}
    </>
  )
}

// ── Inbox page ─────────────────────────────────────────────────────────────────
export default function InboxPage() {
  const [tab, setTab] = useState<'bookings' | 'courses' | 'messages'>('bookings')

  const TABS = [
    { key: 'bookings', label: 'Bookings',    icon: <Calendar size={13} /> },
    { key: 'courses',  label: 'Course Inquiries', icon: <BookOpen size={13} /> },
    { key: 'messages', label: 'Messages',    icon: <Mail size={13} /> },
  ] as const

  return (
    <Shell title="Inbox">
      <div className="ph">
        <div><h1>Inbox</h1><p>All incoming requests and messages</p></div>
      </div>

      <div className="tabs">
        {TABS.map(({ key, label, icon }) => (
          <div key={key} className={`tab flex gap2 ${tab === key ? 'on' : ''}`}
            onClick={() => setTab(key)}>
            {icon}{label}
          </div>
        ))}
      </div>

      {tab === 'bookings' && (
        <ItemList
          endpoint="/inbox/bookings"
          cols={[
            { key: 'name',    label: 'Name' },
            { key: 'service', label: 'Service' },
            { key: 'mode',    label: 'Mode' },
            { key: 'email',   label: 'Email' },
          ]}
        />
      )}

      {tab === 'courses' && (
        <ItemList
          endpoint="/inbox/course-inquiries"
          cols={[
            { key: 'name',   label: 'Name' },
            { key: 'course', label: 'Course' },
            { key: 'mode',   label: 'Mode' },
            { key: 'email',  label: 'Email' },
          ]}
        />
      )}

      {tab === 'messages' && (
        <ItemList
          endpoint="/inbox/messages"
          cols={[
            { key: 'name',    label: 'Name' },
            { key: 'subject', label: 'Subject' },
            { key: 'email',   label: 'Email' },
          ]}
        />
      )}
    </Shell>
  )
}
