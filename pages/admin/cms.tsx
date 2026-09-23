import { useState, useEffect } from 'react'
import Shell from '@/components/Shell'
import { Plus, Edit2, Trash2, Layers, ExternalLink } from 'lucide-react'
import { authedFetch } from '@/lib/auth'
import BlockEditor from '@/components/cms/BlockEditor'
import { type CmsBlock, genBlockId } from '@/components/cms/blockTypes'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.arkasuryacrystals.com'

interface CmsPage {
  id: string
  slug: string
  title: string
  seoTitle: string
  seoDesc: string
  tagline: string
  heroImage: string
  icon: string
  accentColor: string
  // Legacy field — the old plain "paste HTML" box. No longer edited from
  // this page (see `blocks` below); kept in the type only so `openEdit` can
  // read an old page's content once, to seed its first block.
  bodyHtml: string
  blocks: CmsBlock[]
  boundCategorySlug: string | null
  boundCourseSlug: string | null
  isPublished: boolean
  updatedAt?: string
}

type BindType = 'none' | 'category' | 'course'

// Must match the 7 booking-flow category slugs used on the frontend
// (frontend/lib/serviceCategories.ts) and the page routes under frontend/pages/.
// Same list admin/pages/admin/services.tsx uses for the "Booking Category" field.
const CATEGORIES = [
  { slug: 'tarot-reading-services',                title: "Unlock Life's Mysteries (Tarot Reading)" },
  { slug: 'akashic-mokshapat-pastlife',             title: 'Soul Legacy Healing (Akashic, Mokshapat & Past Life)' },
  { slug: 'reiki-crystal-photo-healing',            title: 'Energy Healing Modalities (Reiki, Crystal & Photo Healing)' },
  { slug: 'sound-healing-services',                 title: 'Sound Healing' },
  { slug: 'black-magic-evil-eye-removal',           title: 'Shielding from Dark Energies (Black Magic & Evil Eye Removal)' },
  { slug: 'crystal-grids',                          title: 'Sacred Crystal Alchemy (Crystal Grids)' },
  { slug: 'pendulum-dowsing-gem-stone-counselling', title: 'SoulPath Guidance (Pendulum Dowsing & Gemstone Counselling)' },
]

// Courses have no backend record — they're a hardcoded list in
// frontend/lib/coursesData.ts. Kept in sync with that file by comment, same
// pattern as CATEGORIES above (admin is a separate app/repo from frontend,
// so it can't import that file directly).
const COURSES = [
  { slug: 'tarot-mastery',        title: 'Tarot Mastery' },
  { slug: 'psychic-development',  title: 'Psychic Development' },
  { slug: 'crystal-therapy',      title: 'Crystal Therapy' },
  { slug: 'spiritual-awareness',  title: 'Spiritual Awareness' },
]

const EMPTY = {
  slug: '', title: '', seoTitle: '', seoDesc: '', tagline: '',
  heroImage: '', icon: '', accentColor: '#C9A84C', bodyHtml: '',
  blocks: [] as CmsBlock[],
  boundCategorySlug: '', boundCourseSlug: '', isPublished: false,
}

function slugify(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function CmsAdminPage() {
  const [pages,    setPages]    = useState<CmsPage[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing,  setEditing]  = useState<CmsPage | null>(null)
  const [form,     setForm]     = useState(EMPTY)
  const [bindType, setBindType] = useState<BindType>('none')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  async function load() {
    const r = await fetch(`${API}/cms-pages?published_only=false`)
    const d = await r.json()
    setPages(d.pages || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditing(null); setForm(EMPTY); setBindType('none'); setError(''); setShowForm(true)
  }
  function openEdit(p: CmsPage) {
    setEditing(p)
    // Pages saved before the block editor existed have content in the old
    // `bodyHtml` field and an empty/missing `blocks` array. Seed the editor
    // with that content as a single "Custom HTML" block so nothing is lost —
    // as soon as this page is saved again it becomes blocks-based, and the
    // admin can then rearrange/add blocks around the migrated content.
    const blocks: CmsBlock[] = (p.blocks && p.blocks.length > 0)
      ? p.blocks
      : (p.bodyHtml ? [{ id: genBlockId(), type: 'html', html: p.bodyHtml }] : [])
    setForm({
      slug: p.slug, title: p.title, seoTitle: p.seoTitle || '', seoDesc: p.seoDesc || '',
      tagline: p.tagline || '', heroImage: p.heroImage || '', icon: p.icon || '',
      accentColor: p.accentColor || '#C9A84C', bodyHtml: p.bodyHtml || '',
      blocks,
      boundCategorySlug: p.boundCategorySlug || '', boundCourseSlug: p.boundCourseSlug || '',
      isPublished: p.isPublished,
    })
    setBindType(p.boundCourseSlug ? 'course' : p.boundCategorySlug ? 'category' : 'none')
    setError('')
    setShowForm(true)
  }

  async function save() {
    setSaving(true); setError('')
    const url    = editing ? `${API}/cms-pages/${editing.id}` : `${API}/cms-pages`
    const method = editing ? 'PUT' : 'POST'

    // Only one binding type is active at a time — whichever the "Bind To"
    // selector is on. On edit (PUT), a cleared field must be sent as ''
    // rather than omitted/null, since the backend's "only touch what's
    // sent" convention would otherwise silently ignore an unbind (see
    // handlers/cms_pages.py). On create (POST) there's nothing to clear,
    // so a real null is used instead — '' would be stored literally.
    const categorySlug = bindType === 'category' ? (form.boundCategorySlug || null) : null
    const courseSlug    = bindType === 'course'   ? (form.boundCourseSlug || null)   : null

    const payload = {
      slug: slugify(form.slug || form.title),
      title: form.title, seoTitle: form.seoTitle, seoDesc: form.seoDesc,
      tagline: form.tagline, heroImage: form.heroImage, icon: form.icon,
      accentColor: form.accentColor,
      // bodyHtml is deliberately left out of the payload now — the block
      // editor is the only way to edit content going forward. On PUT that
      // means the old value (if any) just sits there unused; on POST it
      // defaults to '' on the backend. `blocks` is the real content.
      blocks: form.blocks,
      isPublished: form.isPublished,
      boundCategorySlug: editing ? (categorySlug ?? '') : categorySlug,
      boundCourseSlug:   editing ? (courseSlug ?? '')   : courseSlug,
    }
    const res = await authedFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.detail || 'Failed to save — check the slug isn\'t already used.')
      setSaving(false)
      return
    }
    setSaving(false); setShowForm(false); load()
  }

  async function togglePublished(p: CmsPage) {
    await authedFetch(`${API}/cms-pages/${p.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublished: !p.isPublished }),
    })
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this CMS page? Any "Know More" button bound to it will disappear from the site.')) return
    await authedFetch(`${API}/cms-pages/${id}`, { method: 'DELETE' })
    load()
  }

  function categoryTitle(slug: string | null) {
    if (!slug) return null
    return CATEGORIES.find(c => c.slug === slug)?.title || slug
  }

  function courseTitle(slug: string | null) {
    if (!slug) return null
    return COURSES.find(c => c.slug === slug)?.title || slug
  }

  return (
    <Shell title="CMS">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>CMS Pages</h2>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={14} /> Add Page</button>
      </div>

      <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
        Static "Know More" pages. Bind a page to a service category or a course to make its Know More
        button appear on the Services or Courses page — the button only shows once a page is both
        bound and published.
      </p>

      {loading ? <p style={{ color: '#888' }}>Loading...</p> : pages.length === 0 ? (
        <div className="empty-state">No CMS pages yet. Add one to get started.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pages.map(p => (
            <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px' }}>
              <Layers size={16} style={{ color: '#444', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{p.title}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10,
                    background: p.isPublished ? '#16a34a22' : '#dc262622',
                    color: p.isPublished ? '#4ade80' : '#f87171' }}>
                    {p.isPublished ? 'Published' : 'Draft'}
                  </span>
                  {p.isPublished && (
                    <a href={`${SITE_URL}/learn/${p.slug}`} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, color: '#C9A84C', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      /learn/{p.slug} <ExternalLink size={10} />
                    </a>
                  )}
                </div>
                <p style={{ fontSize: 12, color: (p.boundCategorySlug || p.boundCourseSlug) ? '#C9A84C' : '#dc2626', margin: '4px 0 0' }}>
                  {p.boundCategorySlug
                    ? `Bound to category: ${categoryTitle(p.boundCategorySlug)}`
                    : p.boundCourseSlug
                    ? `Bound to course: ${courseTitle(p.boundCourseSlug)}`
                    : 'Not bound — no Know More button links here'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-s" onClick={() => togglePublished(p)}>
                  {p.isPublished ? 'Unpublish' : 'Publish'}
                </button>
                <button className="btn btn-s" onClick={() => openEdit(p)}><Edit2 size={12} /></button>
                <button className="btn btn-s btn-danger" onClick={() => remove(p.id)}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 760 }}>
            <h3 style={{ marginBottom: 20 }}>{editing ? 'Edit CMS Page' : 'Add CMS Page'}</h3>

            {error && (
              <div style={{ background: '#dc262622', color: '#f87171', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div className="form-group">
              <label>Page Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Tarot Reading — Unlock Life's Mysteries" />
            </div>

            <div className="form-group">
              <label>URL Slug</label>
              <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                placeholder="auto-generated from title if left blank" />
              <span className="muted" style={{ fontSize: 11 }}>
                Page will live at {SITE_URL}/learn/{slugify(form.slug || form.title) || '<slug>'}
              </span>
            </div>

            <div className="form-group">
              <label>Bind To</label>
              <select value={bindType} onChange={e => setBindType(e.target.value as BindType)}>
                <option value="none">Not bound (no Know More button will link here)</option>
                <option value="category">A service category (Services page card)</option>
                <option value="course">A course (Courses page card)</option>
              </select>
            </div>

            {bindType === 'category' && (
              <div className="form-group">
                <label>Service Category</label>
                <select value={form.boundCategorySlug} onChange={e => setForm(f => ({ ...f, boundCategorySlug: e.target.value }))}>
                  <option value="">— Choose a category —</option>
                  {CATEGORIES.map(c => (
                    <option key={c.slug} value={c.slug}>{c.title}</option>
                  ))}
                </select>
                <span className="muted" style={{ fontSize: 11 }}>
                  Only one page should be bound per category — binding a second page to the same
                  category takes over that category's Know More button.
                </span>
              </div>
            )}

            {bindType === 'course' && (
              <div className="form-group">
                <label>Course</label>
                <select value={form.boundCourseSlug} onChange={e => setForm(f => ({ ...f, boundCourseSlug: e.target.value }))}>
                  <option value="">— Choose a course —</option>
                  {COURSES.map(c => (
                    <option key={c.slug} value={c.slug}>{c.title}</option>
                  ))}
                </select>
                <span className="muted" style={{ fontSize: 11 }}>
                  Shows a Know More button on this course's card on the Courses page, alongside its
                  existing "View Details" button. Only one page should be bound per course.
                </span>
              </div>
            )}

            <div className="form-group">
              <label>Tagline</label>
              <input value={form.tagline} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
                placeholder="Short italic line shown under the page title" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label>Icon (emoji, optional)</label>
                <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="🃏" />
              </div>
              <div className="form-group">
                <label>Accent Color</label>
                <input type="color" value={form.accentColor} style={{ height: 38, padding: 2 }}
                  onChange={e => setForm(f => ({ ...f, accentColor: e.target.value }))} />
              </div>
            </div>

            <div className="form-group">
              <label>Hero Image URL (optional)</label>
              <input value={form.heroImage} onChange={e => setForm(f => ({ ...f, heroImage: e.target.value }))}
                placeholder="https://..." />
            </div>

            <div className="form-group">
              <label>Page Content *</label>
              <span className="muted" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
                Drag blocks to reorder them. Add images and YouTube videos as their own blocks —
                video thumbnails are fetched automatically from the URL you paste.
              </span>
              <BlockEditor blocks={form.blocks} onChange={blocks => setForm(f => ({ ...f, blocks }))} />
            </div>

            <div className="form-group">
              <label>SEO Title (optional)</label>
              <input value={form.seoTitle} onChange={e => setForm(f => ({ ...f, seoTitle: e.target.value }))}
                placeholder="Defaults to page title if left blank" />
            </div>

            <div className="form-group">
              <label>SEO Description (optional)</label>
              <textarea rows={2} value={form.seoDesc} onChange={e => setForm(f => ({ ...f, seoDesc: e.target.value }))}
                placeholder="Defaults to tagline if left blank" />
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.isPublished}
                  onChange={e => setForm(f => ({ ...f, isPublished: e.target.checked }))} />
                Published (visible on the live site)
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving || !form.title || form.blocks.length === 0}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Page'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  )
}
