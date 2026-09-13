import { useState, useEffect } from 'react'
import Shell from '@/components/Shell'
import { Plus, Edit2, Trash2, GripVertical, Megaphone } from 'lucide-react'
import { authedFetch } from '@/lib/auth'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Announcement {
  id: string; text: string; link?: string; isActive: boolean; order: number
}

const EMPTY = { text: '', link: '', isActive: true, order: 0 }

export default function AnnouncementsAdminPage() {
  const [items,    setItems]    = useState<Announcement[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing,  setEditing]  = useState<Announcement | null>(null)
  const [form,     setForm]     = useState(EMPTY)
  const [saving,   setSaving]   = useState(false)

  async function load() {
    const r = await fetch(`${API}/announcements?active_only=false`)
    const d = await r.json()
    setItems(d.announcements || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() { setEditing(null); setForm(EMPTY); setShowForm(true) }
  function openEdit(a: Announcement) {
    setEditing(a)
    setForm({ text: a.text, link: a.link || '', isActive: a.isActive, order: a.order || 0 })
    setShowForm(true)
  }

  async function save() {
    setSaving(true)
    const url    = editing ? `${API}/announcements/${editing.id}` : `${API}/announcements`
    const method = editing ? 'PUT' : 'POST'
    const payload = { ...form, link: form.link || null }
    await authedFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setSaving(false); setShowForm(false); load()
  }

  async function toggleActive(a: Announcement) {
    await authedFetch(`${API}/announcements/${a.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !a.isActive }),
    })
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this announcement?')) return
    await authedFetch(`${API}/announcements/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <Shell title="Announcements">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Announcement Bar</h2>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={14} /> Add Announcement</button>
      </div>

      <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
        Messages shown in the scrolling bar below the site navbar. Active ones scroll in "Order" sequence,
        oldest/lowest first. Add a link to make an item clickable.
      </p>

      {loading ? <p style={{ color: '#888' }}>Loading...</p> : items.length === 0 ? (
        <div className="empty-state">No announcements yet. Add one to show the scroller on the site.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(a => (
            <div key={a.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px' }}>
              <GripVertical size={16} style={{ color: '#444', cursor: 'grab', flexShrink: 0 }} />
              <Megaphone size={16} style={{ color: '#C9A84C', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{a.text}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10,
                    background: a.isActive ? '#16a34a22' : '#dc262622',
                    color: a.isActive ? '#4ade80' : '#f87171' }}>
                    {a.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {a.link && <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>Links to: {a.link}</p>}
              </div>
              <div style={{ fontSize: 13, color: '#C9A84C', fontWeight: 600, minWidth: 50, textAlign: 'right' }}>
                #{a.order}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-s" onClick={() => toggleActive(a)}>
                  {a.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button className="btn btn-s" onClick={() => openEdit(a)}><Edit2 size={12} /></button>
                <button className="btn btn-s btn-danger" onClick={() => remove(a.id)}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 style={{ marginBottom: 20 }}>{editing ? 'Edit Announcement' : 'Add Announcement'}</h3>

            <div className="form-group">
              <label>Message *</label>
              <textarea rows={2} value={form.text}
                onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                placeholder="e.g. Free shipping on all orders this week!" />
            </div>

            <div className="form-group">
              <label>Link (optional)</label>
              <input value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
                placeholder="/shop or https://..." />
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
              <button className="btn btn-primary" onClick={save} disabled={saving || !form.text}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Announcement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  )
}
