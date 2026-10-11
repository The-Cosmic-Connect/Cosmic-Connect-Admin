import { useState, useEffect } from 'react'
import Shell from '@/components/Shell'
import { Plus, Edit2, Trash2, Star, ExternalLink } from 'lucide-react'
import { authedFetch } from '@/lib/auth'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Testimonial {
  id: string
  author: string
  text: string
  rating: number
  reviewDate?: string
  source?: string
  sourceUrl?: string
  photo?: string
  isActive: boolean
  order: number
}

const EMPTY = {
  author: '', text: '', rating: 5, reviewDate: '', sourceUrl: '', photo: '',
  isActive: true, order: 0,
}

function Stars({ n }: { n: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={12} style={{ color: '#C9A84C', fill: i <= n ? '#C9A84C' : 'transparent' }} />
      ))}
    </span>
  )
}

export default function TestimonialsAdminPage() {
  const [items,    setItems]    = useState<Testimonial[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing,  setEditing]  = useState<Testimonial | null>(null)
  const [form,     setForm]     = useState(EMPTY)
  const [saving,   setSaving]   = useState(false)

  async function load() {
    try {
      const r = await fetch(`${API}/testimonials?active_only=false`)
      const d = await r.json()
      setItems(d.testimonials || [])
    } catch {
      setError('Could not load reviews.')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditing(null)
    // New reviews go to the end of the list by default.
    const nextOrder = items.length ? Math.max(...items.map(i => Number(i.order) || 0)) + 1 : 0
    setForm({ ...EMPTY, order: nextOrder })
    setShowForm(true)
  }
  function openEdit(t: Testimonial) {
    setEditing(t)
    setForm({
      author: t.author, text: t.text, rating: Math.round(Number(t.rating) || 5),
      reviewDate: t.reviewDate || '', sourceUrl: t.sourceUrl || '', photo: t.photo || '',
      isActive: t.isActive, order: Number(t.order) || 0,
    })
    setShowForm(true)
  }

  async function save() {
    setSaving(true); setError('')
    const url    = editing ? `${API}/testimonials/${editing.id}` : `${API}/testimonials`
    const method = editing ? 'PUT' : 'POST'
    const payload = {
      ...form,
      author: form.author.trim(),
      text: form.text.trim(),
      reviewDate: form.reviewDate.trim(),
      sourceUrl: form.sourceUrl.trim(),
      photo: form.photo.trim(),
      source: 'google',
    }
    const r = await authedFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setSaving(false)
    if (!r.ok) { setError(`Save failed (${r.status}). Check the fields and try again.`); return }
    setShowForm(false); load()
  }

  async function toggleActive(t: Testimonial) {
    await authedFetch(`${API}/testimonials/${t.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !t.isActive }),
    })
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this review from the website?')) return
    await authedFetch(`${API}/testimonials/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <Shell title="Reviews">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Homepage Reviews</h2>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={14} /> Add Review</button>
      </div>

      <p style={{ fontSize: 13, color: '#888', marginBottom: 20, lineHeight: 1.6 }}>
        Reviews shown in "What Our Clients Say" on the homepage, in "Order" sequence (lowest first).
        Copy a review from Google Maps: open your listing → Reviews, copy the reviewer's name and text.
        For the link, click the review's share icon → "Copy link". Changes appear on the site within about 10 minutes.
      </p>

      {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {loading ? <p style={{ color: '#888' }}>Loading...</p> : items.length === 0 ? (
        <div className="empty-state">No reviews yet. Until you add one, the homepage keeps showing the original review.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(t => (
            <div key={t.id} className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 16px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{t.author}</span>
                  <Stars n={Math.round(Number(t.rating) || 5)} />
                  {t.reviewDate && <span style={{ fontSize: 12, color: '#888' }}>{t.reviewDate}</span>}
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10,
                    background: t.isActive ? '#16a34a22' : '#dc262622',
                    color: t.isActive ? '#4ade80' : '#f87171' }}>
                    {t.isActive ? 'Shown' : 'Hidden'}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: '#aaa', margin: '6px 0 0', overflow: 'hidden',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                  {t.text}
                </p>
                {t.sourceUrl && (
                  <a href={t.sourceUrl} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: '#C9A84C', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    View on Google <ExternalLink size={11} />
                  </a>
                )}
              </div>
              <div style={{ fontSize: 13, color: '#C9A84C', fontWeight: 600, minWidth: 40, textAlign: 'right' }}>
                #{t.order}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-s" onClick={() => toggleActive(t)}>
                  {t.isActive ? 'Hide' : 'Show'}
                </button>
                <button className="btn btn-s" onClick={() => openEdit(t)}><Edit2 size={12} /></button>
                <button className="btn btn-s btn-danger" onClick={() => remove(t.id)}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <h3 style={{ marginBottom: 20 }}>{editing ? 'Edit Review' : 'Add Review'}</h3>

            <div className="form-group">
              <label>Reviewer name *</label>
              <input value={form.author} maxLength={120}
                onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                placeholder="As shown on Google, e.g. Kartik Pathania" />
            </div>

            <div className="form-group">
              <label>Review text *</label>
              <textarea rows={6} value={form.text} maxLength={4000}
                onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                placeholder="Paste the review exactly as written on Google" />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Star rating</label>
                <select value={form.rating} onChange={e => setForm(f => ({ ...f, rating: Number(e.target.value) }))}>
                  {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Review date (optional)</label>
                <input value={form.reviewDate} maxLength={40}
                  onChange={e => setForm(f => ({ ...f, reviewDate: e.target.value }))}
                  placeholder="e.g. Sep 2026" />
              </div>
            </div>

            <div className="form-group">
              <label>Link to the review on Google (optional)</label>
              <input value={form.sourceUrl} maxLength={1000}
                onChange={e => setForm(f => ({ ...f, sourceUrl: e.target.value }))}
                placeholder="https://maps.app.goo.gl/..." />
            </div>

            <div className="form-group">
              <label>Reviewer photo URL (optional)</label>
              <input value={form.photo} maxLength={1000}
                onChange={e => setForm(f => ({ ...f, photo: e.target.value }))}
                placeholder="Leave empty to show initials" />
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Display order</label>
                <input type="number" value={form.order} min={0}
                  onChange={e => setForm(f => ({ ...f, order: Number(e.target.value) }))} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.isActive}
                    onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                  Show on website
                </label>
              </div>
            </div>

            {error && <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}
                disabled={saving || !form.author.trim() || !form.text.trim()}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  )
}
