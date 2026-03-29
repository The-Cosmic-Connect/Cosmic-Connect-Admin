import { useState, useEffect } from 'react'
import Shell from '@/components/Shell'
import { Calendar, Clock, User, Video, X, CheckCircle, XCircle, RefreshCw } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Booking {
  id: string; agentId: string; serviceId: string
  date: string; startTime: string; endTime: string
  customerName: string; customerEmail: string; customerPhone: string
  priceINR: number; priceUSD: number; currency: string
  status: string; meetLink: string; paymentId: string
  createdAt: string
}
interface Agent   { id: string; name: string }
interface Service { id: string; name: string }

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  confirmed: { bg: '#4CAF5022', color: '#4CAF50' },
  pending:   { bg: '#FF980022', color: '#FF9800' },
  cancelled: { bg: '#f4433622', color: '#f44336' },
  refunded:  { bg: '#9E9E9E22', color: '#9E9E9E' },
}

export default function BookingsPage() {
  const [bookings,  setBookings]  = useState<Booking[]>([])
  const [agents,    setAgents]    = useState<Agent[]>([])
  const [services,  setServices]  = useState<Service[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filterAgent,  setFilterAgent]  = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [selected,  setSelected]  = useState<Booking | null>(null)
  const [cancelling, setCancelling] = useState(false)

  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterAgent)  params.set('agent_id', filterAgent)
    if (filterStatus) params.set('status',   filterStatus)

    const [b, a, s] = await Promise.all([
      fetch(`${API}/bookings?${params}`).then(r => r.json()),
      fetch(`${API}/agents?active_only=false`).then(r => r.json()),
      fetch(`${API}/services?active_only=false`).then(r => r.json()),
    ])
    setBookings(b.bookings || [])
    setAgents(a.agents || [])
    setServices(s.services || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filterAgent, filterStatus])

  async function cancelBooking(bookingId: string) {
    if (!confirm('Cancel this booking? A refund will need to be processed manually.')) return
    setCancelling(true)
    await fetch(`${API}/bookings/${bookingId}/cancel`, { method: 'POST' })
    setCancelling(false)
    setSelected(null)
    load()
  }

  function agentName(id: string) { return agents.find(a => a.id === id)?.name || id }
  function serviceName(id: string) { return services.find(s => s.id === id)?.name || id }

  const stats = {
    total:     bookings.length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    pending:   bookings.filter(b => b.status === 'pending').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
  }

  return (
    <Shell title="Bookings">
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total',     value: stats.total,     color: '#C9A84C' },
          { label: 'Confirmed', value: stats.confirmed, color: '#4CAF50' },
          { label: 'Pending',   value: stats.pending,   color: '#FF9800' },
          { label: 'Cancelled', value: stats.cancelled, color: '#f44336' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)}
          style={{ padding: '6px 12px', background: '#1A0A2E', border: '1px solid #2D1B5E',
            color: '#F5EDD6', borderRadius: 6, fontSize: 13 }}>
          <option value="">All Agents</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>

        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '6px 12px', background: '#1A0A2E', border: '1px solid #2D1B5E',
            color: '#F5EDD6', borderRadius: 6, fontSize: 13 }}>
          <option value="">All Status</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>

        <button className="btn btn-s" onClick={load} style={{ marginLeft: 'auto' }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Bookings table */}
      {loading ? (
        <p style={{ color: '#888', fontSize: 13 }}>Loading...</p>
      ) : bookings.length === 0 ? (
        <div className="empty-state"><p>No bookings found.</p></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2D1B5E' }}>
                {['Date & Time','Customer','Agent','Service','Amount','Status','Meet','Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#888',
                    fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => {
                const sc = STATUS_COLORS[b.status] || STATUS_COLORS.pending
                return (
                  <tr key={b.id} style={{ borderBottom: '1px solid #1A0A2E' }}
                    className="table-row">
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 500, color: '#F5EDD6' }}>{b.date}</div>
                      <div style={{ color: '#888', fontSize: 11 }}>{b.startTime} – {b.endTime} IST</div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ color: '#F5EDD6' }}>{b.customerName}</div>
                      <div style={{ color: '#888', fontSize: 11 }}>{b.customerEmail}</div>
                    </td>
                    <td style={{ padding: '12px', color: '#ccc' }}>{agentName(b.agentId)}</td>
                    <td style={{ padding: '12px', color: '#ccc' }}>{serviceName(b.serviceId)}</td>
                    <td style={{ padding: '12px', color: '#C9A84C', fontWeight: 600 }}>
                      {b.currency === 'INR' ? `₹${b.priceINR}` : `$${b.priceUSD}`}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 4, fontSize: 11,
                        background: sc.bg, color: sc.color, fontWeight: 500 }}>
                        {b.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {b.meetLink ? (
                        <a href={b.meetLink} target="_blank" rel="noopener noreferrer"
                          style={{ color: '#4CAF50', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                          <Video size={12} /> Join
                        </a>
                      ) : <span style={{ color: '#444', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <button className="btn btn-s" onClick={() => setSelected(b)}>View</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Booking detail modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Booking Details</h3>
              <button onClick={() => setSelected(null)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 500,
                  background: STATUS_COLORS[selected.status]?.bg, color: STATUS_COLORS[selected.status]?.color }}>
                  {selected.status}
                </span>
                <span style={{ fontSize: 12, color: '#888', padding: '3px 0' }}>
                  ID: {selected.id.slice(0,8).toUpperCase()}
                </span>
              </div>

              {[
                { label: 'Customer',  value: `${selected.customerName} · ${selected.customerEmail} · ${selected.customerPhone}` },
                { label: 'Service',   value: serviceName(selected.serviceId) },
                { label: 'Agent',     value: agentName(selected.agentId) },
                { label: 'Date',      value: selected.date },
                { label: 'Time',      value: `${selected.startTime} – ${selected.endTime} IST` },
                { label: 'Amount',    value: selected.currency === 'INR' ? `₹${selected.priceINR}` : `$${selected.priceUSD}` },
                { label: 'Payment ID', value: selected.paymentId || '—' },
                { label: 'Booked At', value: new Date(selected.createdAt).toLocaleString('en-IN') },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', gap: 12 }}>
                  <span style={{ color: '#888', fontSize: 12, width: 100, flexShrink: 0 }}>{row.label}</span>
                  <span style={{ color: '#F5EDD6', fontSize: 13 }}>{row.value}</span>
                </div>
              ))}

              {selected.meetLink && (
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ color: '#888', fontSize: 12, width: 100, flexShrink: 0 }}>Meet Link</span>
                  <a href={selected.meetLink} target="_blank" rel="noopener noreferrer"
                    style={{ color: '#4CAF50', fontSize: 13, wordBreak: 'break-all' }}>
                    {selected.meetLink}
                  </a>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setSelected(null)}>Close</button>
              {selected.status === 'confirmed' || selected.status === 'pending' ? (
                <button className="btn btn-danger" onClick={() => cancelBooking(selected.id)} disabled={cancelling}>
                  <XCircle size={14} /> {cancelling ? 'Cancelling...' : 'Cancel Booking'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </Shell>
  )
}