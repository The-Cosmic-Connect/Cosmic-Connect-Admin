import { useState, useEffect, useRef } from 'react'
import Shell from '@/components/Shell'
import { Plus, Edit2, Trash2, GripVertical, Upload, Image as ImageIcon } from 'lucide-react'
import { authedFetch } from '@/lib/auth'
import { SITE_ROUTES } from '@/lib/siteRoutes'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Slide {
  id: string
  imageUrl?: string
  headline: string
  subtext: string
  ctaText?: string
  ctaLink?: string
  layout: 'full-bleed' | 'split' | 'text-only'
  textPosition: 'left' | 'center' | 'right'
  overlayStyle: 'none' | 'dark' | 'gradient' | 'plum'
  isActive: boolean
  order: number
}

const EMPTY = {
  imageUrl: '', headline: '', subtext: '', ctaText: '', ctaLink: '',
  layout: 'full-bleed' as Slide['layout'],
  textPosition: 'center' as Slide['textPosition'],
  overlayStyle: 'gradient' as Slide['overlayStyle'],
  isActive: true, order: 0,
}

const LAYOUTS: { value: Slide['layout']; label: string; hint: string }[] = [
  { value: 'full-bleed', label: 'Full Bleed',  hint: 'Image fills the whole banner, text overlaid' },
  { value: 'split',      label: 'Split',       hint: 'Image on one side, text panel on the other' },
  { value: 'text-only',  label: 'Text Only',   hint: 'No image — styled text/CTA panel' },
]
const POSITIONS: Slide['textPosition'][] = ['left', 'center', 'right']
const OVERLAYS: Slide['overlayStyle'][] = ['none', 'dark', 'gradient', 'plum']

// ── image upload (same pre-signed S3 flow as the Shop page) ────────────────

async function compressImage(file: File): Promise<{ blob: Blob; contentType: string; filename: string }> {
  if (!file.type.startsWith('image/') || file.size < 200 * 1024) {
    return { blob: file, contentType: file.type || 'image/jpeg', filename: file.name }
  }
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = URL.createObjectURL(file)
  })
  const MAX = 1920
  const scale = Math.min(1, MAX / Math.max(img.width, img.height))
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85))
  const base = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '-')
  return { blob, contentType: 'image/jpeg', filename: `${base || 'slide'}.jpg` }
}

async function uploadImage(file: File): Promise<string> {
  const { blob, contentType, filename } = await compressImage(file)
  const signRes = await authedFetch(`${API}/uploads/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, contentType, size: blob.size }),
  })
  if (!signRes.ok) throw new Error(`Sign failed: ${await signRes.text()}`)
  const { uploadUrl, publicUrl } = await signRes.json()
  const putRes = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob })
  if (!putRes.ok) throw new Error(`S3 upload failed (${putRes.status})`)
  return publicUrl
}

export default function CarouselAdminPage() {
  const [slides,   setSlides]   = useState<Slide[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing,  setEditing]  = useState<Slide | null>(null)
  const [form,     setForm]     = useState(EMPTY)
  const [saving,   setSaving]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function load() {
    const r = await fetch(`${API}/carousel-slides?active_only=false`)
    const d = await r.json()
    setSlides(d.slides || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() { setEditing(null); setForm(EMPTY); setShowForm(true) }
  function openEdit(s: Slide) {
    setEditing(s)
    setForm({
      imageUrl: s.imageUrl || '', headline: s.headline, subtext: s.subtext,
      ctaText: s.ctaText || '', ctaLink: s.ctaLink || '',
      layout: s.layout || 'full-bleed', textPosition: s.textPosition || 'center',
      overlayStyle: s.overlayStyle || 'gradient', isActive: s.isActive, order: s.order || 0,
    })
    setShowForm(true)
  }

  async function handleFile(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true); setUploadErr('')
    try {
      const url = await uploadImage(files[0])
      setForm(f => ({ ...f, imageUrl: url }))
    } catch (e: any) {
      setUploadErr(e.message || 'Upload failed')
    }
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function save() {
    setSaving(true)
    const url    = editing ? `${API}/carousel-slides/${editing.id}` : `${API}/carousel-slides`
    const method = editing ? 'PUT' : 'POST'
    const payload = {
      ...form,
      imageUrl: form.imageUrl || null,
      ctaText:  form.ctaText  || null,
      ctaLink:  form.ctaLink  || null,
    }
    await authedFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setSaving(false); setShowForm(false); load()
  }

  async function toggleActive(s: Slide) {
    await authedFetch(`${API}/carousel-slides/${s.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !s.isActive }),
    })
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this slide?')) return
    await authedFetch(`${API}/carousel-slides/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <Shell title="Homepage Carousel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Homepage Carousel</h2>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={14} /> Add Slide</button>
      </div>

      <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
        Banner slides shown at the top of the homepage, above the hero. Each slide's layout, text
        position and overlay can be set independently — that's the "shape/design" per slide.
      </p>

      {loading ? <p style={{ color: '#888' }}>Loading...</p> : slides.length === 0 ? (
        <div className="empty-state">No slides yet. Add one to show the carousel on the homepage.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {slides.map(s => (
            <div key={s.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px' }}>
              <GripVertical size={16} style={{ color: '#444', cursor: 'grab', flexShrink: 0 }} />
              <div style={{
                width: 64, height: 44, borderRadius: 4, overflow: 'hidden', flexShrink: 0,
                background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {s.imageUrl ? (
                  <img src={s.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : <ImageIcon size={16} style={{ color: '#444' }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{s.headline || '(no headline)'}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10,
                    background: s.isActive ? '#16a34a22' : '#dc262622',
                    color: s.isActive ? '#4ade80' : '#f87171' }}>
                    {s.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>
                  {s.layout} · {s.textPosition} text · {s.overlayStyle} overlay
                </p>
              </div>
              <div style={{ fontSize: 13, color: '#C9A84C', fontWeight: 600, minWidth: 40, textAlign: 'right' }}>
                #{s.order}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-s" onClick={() => toggleActive(s)}>
                  {s.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button className="btn btn-s" onClick={() => openEdit(s)}><Edit2 size={12} /></button>
                <button className="btn btn-s btn-danger" onClick={() => remove(s.id)}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <h3 style={{ marginBottom: 20 }}>{editing ? 'Edit Slide' : 'Add Slide'}</h3>

            <div className="form-group">
              <label>Image</label>
              <div style={{ border: '1px dashed #ccc', borderRadius: 4, padding: 12, background: '#fafafa', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button type="button" className="btn btn-s btn-sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
                    <Upload size={12} /> {uploading ? 'Uploading…' : form.imageUrl ? 'Replace image' : 'Add image'}
                  </button>
                  <span className="muted" style={{ fontSize: 12 }}>
                    Optional for the "Text Only" layout. For no/minimal cropping, upload at 2400×1030px
                    (21:9 — matches the banner shape on desktop, narrower crop shown on mobile).
                  </span>
                </div>
                <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => handleFile(e.target.files)} />
                {uploadErr && <div className="alert alert-e" style={{ marginTop: 8 }}>{uploadErr}</div>}
              </div>
              {form.imageUrl && (
                <div style={{ position: 'relative', width: '100%', height: 120, borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                  <img src={form.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button type="button" onClick={() => setForm(f => ({ ...f, imageUrl: '' }))}
                    style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff',
                      border: 'none', borderRadius: 3, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>
                    Remove
                  </button>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Headline</label>
              <input value={form.headline} onChange={e => setForm(f => ({ ...f, headline: e.target.value }))}
                placeholder="e.g. Diwali Crystal Collection" />
            </div>

            <div className="form-group">
              <label>Subtext</label>
              <textarea rows={2} value={form.subtext} onChange={e => setForm(f => ({ ...f, subtext: e.target.value }))}
                placeholder="Short supporting line under the headline" />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Button Text</label>
                <input value={form.ctaText} onChange={e => setForm(f => ({ ...f, ctaText: e.target.value }))} placeholder="Shop Now" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Button Link</label>
                <input value={form.ctaLink} list="site-routes" onChange={e => setForm(f => ({ ...f, ctaLink: e.target.value }))} placeholder="/shop" />
                <datalist id="site-routes">
                  {SITE_ROUTES.map(r => <option key={r.path} value={r.path}>{r.label}</option>)}
                </datalist>
              </div>
            </div>

            <div className="form-group">
              <label>Layout (slide shape)</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {LAYOUTS.map(l => (
                  <button key={l.value} type="button" title={l.hint}
                    onClick={() => setForm(f => ({ ...f, layout: l.value }))}
                    style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid',
                      borderColor: form.layout === l.value ? '#C9A84C' : '#333',
                      background: form.layout === l.value ? '#C9A84C22' : 'transparent',
                      color: form.layout === l.value ? '#C9A84C' : '#888', fontSize: 12, cursor: 'pointer' }}>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Text Position</label>
                <select value={form.textPosition} onChange={e => setForm(f => ({ ...f, textPosition: e.target.value as Slide['textPosition'] }))}>
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Overlay</label>
                <select value={form.overlayStyle} onChange={e => setForm(f => ({ ...f, overlayStyle: e.target.value as Slide['overlayStyle'] }))}>
                  {OVERLAYS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
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
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Slide'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  )
}
