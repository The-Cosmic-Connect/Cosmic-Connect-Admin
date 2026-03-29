import { useState, useEffect } from 'react'
import Shell from '@/components/Shell'
import { Plus, Trash2, Edit2, Link2, Check, X, ChevronDown, ChevronUp } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface AgentService { serviceId: string; priceINR: number; priceUSD: number; bufferMins: number }
interface Agent {
  id: string; name: string; email: string; bio: string; photo: string
  isActive: boolean; googleConnected: boolean; googleEmail?: string
  schedule: {
    morning:    { start: string; end: string }
    afternoon:  { start: string; end: string }
    activeDays: number[]
  }
  services: AgentService[]
}
interface Service { id: string; name: string; durationMins: number }

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

const EMPTY_AGENT = {
  name: '', email: '', bio: '', photo: '', isActive: true,
  schedule: {
    morning:    { start: '11:30', end: '14:30' },
    afternoon:  { start: '16:30', end: '20:30' },
    activeDays: [0,1,2,3,4,5],
  },
  services: [],
}

export default function AgentsPage() {
  const [agents,   setAgents]   = useState<Agent[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing,  setEditing]  = useState<Agent | null>(null)
  const [form,     setForm]     = useState<any>(EMPTY_AGENT)
  const [saving,   setSaving]   = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [error,    setError]    = useState('')

  async function load() {
    setLoading(true)
    const [a, s] = await Promise.all([
      fetch(`${API}/agents?active_only=false`).then(r => r.json()),
      fetch(`${API}/services`).then(r => r.json()),
    ])
    setAgents(a.agents || [])
    setServices(s.services || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_AGENT)
    setShowForm(true)
    setError('')
  }

  function openEdit(agent: Agent) {
    setEditing(agent)
    setForm({
      name: agent.name, email: agent.email, bio: agent.bio,
      photo: agent.photo, isActive: agent.isActive,
      schedule: agent.schedule,
      services: agent.services || [],
    })
    setShowForm(true)
    setError('')
  }

  function toggleDay(day: number) {
    const days = form.schedule.activeDays
    setForm((f: any) => ({
      ...f,
      schedule: {
        ...f.schedule,
        activeDays: days.includes(day) ? days.filter((d: number) => d !== day) : [...days, day].sort(),
      }
    }))
  }

  function setWindow(slot: 'morning' | 'afternoon', key: 'start' | 'end', val: string) {
    setForm((f: any) => ({ ...f, schedule: { ...f.schedule, [slot]: { ...f.schedule[slot], [key]: val } } }))
  }

  function setServicePrice(serviceId: string, field: keyof AgentService, val: any) {
    setForm((f: any) => {
      const exists = f.services.find((s: AgentService) => s.serviceId === serviceId)
      if (exists) {
        return { ...f, services: f.services.map((s: AgentService) => s.serviceId === serviceId ? { ...s, [field]: val } : s) }
      }
      return { ...f, services: [...f.services, { serviceId, priceINR: 0, priceUSD: 0, bufferMins: 15, [field]: val }] }
    })
  }

  function toggleService(serviceId: string) {
    setForm((f: any) => {
      const exists = f.services.find((s: AgentService) => s.serviceId === serviceId)
      if (exists) return { ...f, services: f.services.filter((s: AgentService) => s.serviceId !== serviceId) }
      return { ...f, services: [...f.services, { serviceId, priceINR: 0, priceUSD: 0, bufferMins: 15 }] }
    })
  }

  async function save() {
    if (!form.name || !form.email) { setError('Name and email are required'); return }
    setSaving(true); setError('')
    try {
      const method = editing ? 'PUT' : 'POST'
      const url    = editing ? `${API}/agents/${editing.id}` : `${API}/agents`
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!r.ok) throw new Error(await r.text())
      setShowForm(false)
      load()
    } catch (e: any) {
      setError(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function deleteAgent(id: string) {
    if (!confirm('Delete this agent?')) return
    await fetch(`${API}/agents/${id}`, { method: 'DELETE' })
    load()
  }

  async function connectGoogle(agent: Agent) {
    const r = await fetch(`${API}/agents/${agent.id}/google/connect`)
    const data = await r.json()
    window.open(data.url, '_blank', 'width=500,height=600')
  }

  return (
    <Shell title="Agents">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Service Agents</h2>
          <p style={{ margin: '4px 0 0', color: '#888', fontSize: 13 }}>Manage healers and their availability</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={14} /> Add Agent
        </button>
      </div>

      {/* Agent list */}
      {loading ? (
        <p style={{ color: '#888', fontSize: 13 }}>Loading...</p>
      ) : agents.length === 0 ? (
        <div className="empty-state">
          <p>No agents yet. Add your first healer.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {agents.map(agent => (
            <div key={agent.id} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {/* Avatar */}
                {agent.photo ? (
                  <img src={agent.photo} alt={agent.name}
                    style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid #C9A84C44' }} />
                ) : (
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#2D1B5E',
                    border: '2px solid #C9A84C44', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: '#C9A84C', fontWeight: 700, fontSize: 18 }}>
                    {agent.name[0]}
                  </div>
                )}

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{agent.name}</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4,
                      background: agent.isActive ? '#C9A84C22' : '#ffffff11',
                      color: agent.isActive ? '#C9A84C' : '#888' }}>
                      {agent.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {agent.googleConnected && (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4,
                        background: '#4CAF5022', color: '#4CAF50' }}>
                        ✓ Google Connected
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '2px 0 0', color: '#888', fontSize: 12 }}>{agent.email}</p>
                  <p style={{ margin: '2px 0 0', color: '#666', fontSize: 12 }}>
                    {agent.services?.length || 0} service{agent.services?.length !== 1 ? 's' : ''} · {' '}
                    Morning: {agent.schedule?.morning?.start}–{agent.schedule?.morning?.end} · {' '}
                    Afternoon: {agent.schedule?.afternoon?.start}–{agent.schedule?.afternoon?.end}
                  </p>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-s" onClick={() => connectGoogle(agent)}
                    title="Connect Google Calendar">
                    <Link2 size={13} /> {agent.googleConnected ? 'Reconnect' : 'Connect Google'}
                  </button>
                  <button className="btn btn-s" onClick={() => openEdit(agent)}>
                    <Edit2 size={13} />
                  </button>
                  <button className="btn btn-s btn-danger" onClick={() => deleteAgent(agent.id)}>
                    <Trash2 size={13} />
                  </button>
                  <button className="btn btn-s" onClick={() => setExpanded(expanded === agent.id ? null : agent.id)}>
                    {expanded === agent.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {expanded === agent.id && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #2D1B5E' }}>
                  <p style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>Services offered:</p>
                  {agent.services?.length ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {agent.services.map(as => {
                        const svc = services.find(s => s.id === as.serviceId)
                        return svc ? (
                          <div key={as.serviceId} style={{ padding: '6px 12px', background: '#2D1B5E44',
                            border: '1px solid #C9A84C22', borderRadius: 6, fontSize: 12 }}>
                            <span style={{ color: '#F5EDD6' }}>{svc.name}</span>
                            <span style={{ color: '#C9A84C', marginLeft: 8 }}>₹{as.priceINR} / ${as.priceUSD}</span>
                            <span style={{ color: '#666', marginLeft: 8 }}>{as.bufferMins}m buffer</span>
                          </div>
                        ) : null
                      })}
                    </div>
                  ) : <p style={{ color: '#666', fontSize: 12 }}>No services assigned</p>}

                  <p style={{ color: '#888', fontSize: 12, marginTop: 12, marginBottom: 4 }}>Active days:</p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {DAYS.map((d, i) => (
                      <span key={d} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11,
                        background: agent.schedule?.activeDays?.includes(i) ? '#C9A84C22' : '#ffffff08',
                        color: agent.schedule?.activeDays?.includes(i) ? '#C9A84C' : '#555' }}>
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 680, width: '95vw', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? 'Edit Agent' : 'Add Agent'}</h3>
              <button onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {error && <div className="error-banner">{error}</div>}

              {/* Basic info */}
              <div>
                <p className="section-label">Basic Info</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="field">
                    <label>Name *</label>
                    <input value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="Dr. Usha Bhatt" />
                  </div>
                  <div className="field">
                    <label>Email (Google Account) *</label>
                    <input value={form.email} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} placeholder="agent@gmail.com" />
                  </div>
                </div>
                <div className="field" style={{ marginTop: 12 }}>
                  <label>Bio</label>
                  <textarea value={form.bio} onChange={e => setForm((f: any) => ({ ...f, bio: e.target.value }))}
                    placeholder="Short description shown to customers..." rows={3} />
                </div>
                <div className="field" style={{ marginTop: 12 }}>
                  <label>Photo URL (S3)</label>
                  <input value={form.photo} onChange={e => setForm((f: any) => ({ ...f, photo: e.target.value }))} placeholder="https://..." />
                </div>
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" id="isActive" checked={form.isActive}
                    onChange={e => setForm((f: any) => ({ ...f, isActive: e.target.checked }))} />
                  <label htmlFor="isActive" style={{ fontSize: 13, color: '#ccc', cursor: 'pointer' }}>Active (visible to customers)</label>
                </div>
              </div>

              {/* Working hours */}
              <div>
                <p className="section-label">Working Hours (IST)</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Morning Session</p>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="time" value={form.schedule.morning.start}
                        onChange={e => setWindow('morning', 'start', e.target.value)}
                        style={{ flex: 1 }} />
                      <span style={{ color: '#666' }}>to</span>
                      <input type="time" value={form.schedule.morning.end}
                        onChange={e => setWindow('morning', 'end', e.target.value)}
                        style={{ flex: 1 }} />
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Afternoon Session</p>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="time" value={form.schedule.afternoon.start}
                        onChange={e => setWindow('afternoon', 'start', e.target.value)}
                        style={{ flex: 1 }} />
                      <span style={{ color: '#666' }}>to</span>
                      <input type="time" value={form.schedule.afternoon.end}
                        onChange={e => setWindow('afternoon', 'end', e.target.value)}
                        style={{ flex: 1 }} />
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: 12, color: '#888', marginTop: 14, marginBottom: 8 }}>Active Days</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {DAYS.map((d, i) => (
                    <button key={d} onClick={() => toggleDay(i)}
                      style={{ padding: '4px 12px', borderRadius: 4, border: '1px solid',
                        fontSize: 12, cursor: 'pointer',
                        borderColor: form.schedule.activeDays.includes(i) ? '#C9A84C' : '#333',
                        background: form.schedule.activeDays.includes(i) ? '#C9A84C22' : 'transparent',
                        color: form.schedule.activeDays.includes(i) ? '#C9A84C' : '#888' }}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Services */}
              <div>
                <p className="section-label">Services & Pricing</p>
                {services.length === 0 ? (
                  <p style={{ color: '#666', fontSize: 12 }}>No services available. Create services first.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {services.map(svc => {
                      const as = form.services.find((s: AgentService) => s.serviceId === svc.id)
                      const enabled = !!as
                      return (
                        <div key={svc.id} style={{ border: '1px solid', borderRadius: 6, padding: 12,
                          borderColor: enabled ? '#C9A84C44' : '#2D1B5E',
                          background: enabled ? '#C9A84C08' : 'transparent' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: enabled ? 10 : 0 }}>
                            <input type="checkbox" checked={enabled} onChange={() => toggleService(svc.id)} />
                            <span style={{ fontSize: 14, fontWeight: 500, color: '#F5EDD6' }}>{svc.name}</span>
                            <span style={{ fontSize: 11, color: '#888', marginLeft: 4 }}>{svc.durationMins} mins</span>
                          </div>
                          {enabled && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginLeft: 24 }}>
                              <div className="field">
                                <label>Price INR (₹)</label>
                                <input type="number" value={as.priceINR}
                                  onChange={e => setServicePrice(svc.id, 'priceINR', Number(e.target.value))} />
                              </div>
                              <div className="field">
                                <label>Price USD ($)</label>
                                <input type="number" value={as.priceUSD}
                                  onChange={e => setServicePrice(svc.id, 'priceUSD', Number(e.target.value))} />
                              </div>
                              <div className="field">
                                <label>Buffer (mins)</label>
                                <input type="number" value={as.bufferMins}
                                  onChange={e => setServicePrice(svc.id, 'bufferMins', Number(e.target.value))} />
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Agent'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  )
}