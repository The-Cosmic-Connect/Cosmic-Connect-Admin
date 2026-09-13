import { useState, useEffect } from 'react'
import Shell from '@/components/Shell'
import { Plus, Edit2, Trash2, GripVertical } from 'lucide-react'
import { authedFetch } from '@/lib/auth'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Service {
  id: string; name: string; description: string
  durationMins: number; isActive: boolean; order: number
  category?: string
}

const EMPTY = { name: '', description: '', durationMins: 60, isActive: true, order: 0, category: '' }

// Must match the 7 booking-flow category slugs used on the frontend
// (frontend/lib/serviceCategories.ts) and the page routes under frontend/pages/.
const CATEGORIES = [
  { slug: 'tarot-reading-services',                title: 'Tarot Reading (Unlock Life\'s Mysteries)' },
  { slug: 'akashic-mokshapat-pastlife',             title: 'Akashic, Mokshapat & Past Life (Soul Legacy Healing)' },
  { slug: 'reiki-crystal-photo-healing',            title: 'Reiki, Crystal & Photo Healing (Energy Healing Modalities)' },
  { slug: 'sound-healing-services',                 title: 'Sound Healing' },
  { slug: 'black-magic-evil-eye-removal',           title: 'Black Magic & Evil Eye Removal (Shielding from Dark Energies)' },
  { slug: 'crystal-grids',                          title: 'Crystal Grids (Sacred Crystal Alchemy)' },
  { slug: 'pendulum-dowsing-gem-stone-counselling', title: 'Pendulum Dowsing & Gemstone Counselling (SoulPath Guidance)' },
]

export default function ServicesAdminPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing,  setEditing]  = useState<Service | null>(null)
  const [form,     setForm]     = useState(EMPTY)
  const [saving,   setSaving]   = useState(false)

  async function load() {
    const r = await fetch(`${API}/services?active_only=false`)
    const d = await r.json()
    setServices(d.services || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() { setEditing(null); setForm(EMPTY); setShowForm(true) }
  function openEdit(s: Service) {
    setEditing(s)
    setForm({ name: s.name, description: s.description, durationMins: s.durationMins, isActive: s.isActive, order: s.order || 0, category: s.category || '' })
    setShowForm(true)
  }

  async function save() {
    setSaving(true)
    const url    = editing ? `${API}/services/${editing.id}` : `${API}/services`
    const method = editing ? 'PUT' : 'POST'
    const payload = { ...form, category: form.category || null }
    // Admin-only write — must carry the JWT.
    await authedFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setSaving(false); setShowForm(false); load()
  }

  async function toggleActive(s: Service) {
    // Admin-only write — must carry the JWT.
    await authedFetch(`${API}/services/${s.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !s.isActive }),
    })
    load()
  }

  async function deleteService(id: string) {
    if (!confirm('Delete this service? Agents with this service assigned will lose it.')) return
    // Admin-only write — must carry the JWT.
    await authedFetch(`${API}/services/${id}`, { method: 'DELETE' })
    load()
  }

  const DURATION_PRESETS = [30, 45, 60, 90, 120]

  return (
    <Shell title="Services">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Services</h2>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={14} /> Add Service</button>
      </div>

      <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
        Define the types of sessions offered. Assign services to agents and set per-agent pricing on the Agents page.
      </p>

      {loading ? <p style={{ color: '#888' }}>Loading...</p> : services.length === 0 ? (
        <div className="empty-state">No services yet. Add one to get started.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {services.map(s => (
            <div key={s.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px' }}>
              <GripVertical size={16} style={{ color: '#444', cursor: 'grab', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10,
                    background: s.isActive ? '#16a34a22' : '#dc262622',
                    color: s.isActive ? '#4ade80' : '#f87171' }}>
                    {s.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {s.description && <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>{s.description}</p>}
                <p style={{ fontSize: 11, color: s.category ? '#C9A84C' : '#dc2626', margin: '4px 0 0' }}>
                  {s.category ? CATEGORIES.find(c => c.slug === s.category)?.title || s.category : 'No category — hidden from booking pages'}
                </p>
              </div>
              <div style={{ fontSize: 13, color: '#C9A84C', fontWeight: 600, minWidth: 70, textAlign: 'right' }}>
                {s.durationMins} mins
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-s" onClick={() => toggleActive(s)}>
                  {s.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button className="btn btn-s" onClick={() => openEdit(s)}><Edit2 size={12} /></button>
                <button className="btn btn-s btn-danger" onClick={() => deleteService(s.id)}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 style={{ marginBottom: 20 }}>{editing ? 'Edit Service' : 'Add Service'}</h3>

            <div className="form-group">
              <label>Service Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Tarot Reading, Akashic Record Reading" />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea rows={3} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What does this session involve?" />
            </div>

            <div className="form-group">
              <label>Duration (minutes) *</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {DURATION_PRESETS.map(d => (
                  <button key={d} type="button" onClick={() => setForm(f => ({ ...f, durationMins: d }))}
                    style={{ padding: '4px 14px', borderRadius: 4, border: '1px solid',
                      borderColor: form.durationMins === d ? '#C9A84C' : '#333',
                      background: form.durationMins === d ? '#C9A84C22' : 'transparent',
                      color: form.durationMins === d ? '#C9A84C' : '#888',
                      fontSize: 13, cursor: 'pointer' }}>
                    {d} min
                  </button>
                ))}
              </div>
              <input type="number" value={form.durationMins} min={15} max={480}
                onChange={e => setForm(f => ({ ...f, durationMins: Number(e.target.value) }))}
                placeholder="Or enter custom duration" />
            </div>

            <div className="form-group">
              <label>Booking Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="">— Uncategorized (won't show on a category page) —</option>
                {CATEGORIES.map(c => (
                  <option key={c.slug} value={c.slug}>{c.title}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Display Order</label>
              <input type="number" value={form.order} min={0}
                onChange={e => setForm(f => ({ ...f, order: Number(e.target.value) }))} />
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.isActive}
                  onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                Active
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving || !form.name}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Service'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  )
}