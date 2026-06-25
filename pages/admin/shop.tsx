import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import Shell from '@/components/Shell'
import { Plus, Pencil, Trash2, X, Upload, Image as ImageIcon } from 'lucide-react'
import { fetchAllProducts, getCachedProducts, invalidateProductsCache } from '@/lib/fetchProducts'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Canonical collection names — must match what the frontend taxonomy expects
// (lib/shopTaxonomy.ts on the frontend). Products store these in `collections[]`.
const COLLECTIONS = [
  'Bracelets', 'Zodiac Bracelets', 'Therapy Bracelets',
  'Raw / Rough Stones', 'Tumble Stones', 'Crystal Clusters',
  'Towers, Wands & Pencils', 'Balls & Spheres', 'Pyramids',
  'Puffy Hearts', 'Palm Stones', 'Crystal Tree',
  'Rollers & Gua Sha', 'Pendants & Jewellery',
  'Angels', 'Idols & Figurines',
  'Evil Eye Products', 'Jap Mala', 'Rudraksh', 'Feng Shui',
  'Dowsers', 'Energy Generator Orgones', 'Intention Coin',
  'Sage & Incense', 'Cleansing & Charging',
  'Meditation Essentials', 'Energized Water', 'Lamp',
]

// ── helpers ──────────────────────────────────────────────────────────────────

function toSlug(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

/**
 * Walk the paginated /products endpoint with caching.
 * Implementation lives in lib/fetchProducts.ts so other admin pages can share
 * the same cache (and call invalidateProductsCache() to bust it on edits).
 */

/**
 * Resize an image to max 1600px on the long edge and re-encode as JPEG with
 * quality 0.85. Returns a Blob suitable for direct PUT to S3. This keeps photo
 * uploads under ~500KB even from a phone camera.
 */
async function compressImage(file: File): Promise<{ blob: Blob; contentType: string; filename: string }> {
  // Skip resize for tiny files or non-images
  if (!file.type.startsWith('image/') || file.size < 200 * 1024) {
    return { blob: file, contentType: file.type || 'image/jpeg', filename: file.name }
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = URL.createObjectURL(file)
  })

  const MAX = 1600
  const scale = Math.min(1, MAX / Math.max(img.width, img.height))
  const w = Math.round(img.width  * scale)
  const h = Math.round(img.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)

  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85),
  )

  // Strip the original extension; we always re-encode to .jpg
  const base = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '-')
  return { blob, contentType: 'image/jpeg', filename: `${base || 'image'}.jpg` }
}

/**
 * Upload a single file to S3 via the backend's pre-signed URL endpoint.
 * Returns the final public URL where the image will be readable.
 */
async function uploadImage(file: File): Promise<string> {
  const { blob, contentType, filename } = await compressImage(file)

  const signRes = await fetch(`${API}/uploads/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, contentType, size: blob.size }),
  })
  if (!signRes.ok) throw new Error(`Sign failed: ${await signRes.text()}`)
  const { uploadUrl, publicUrl } = await signRes.json()

  // Direct browser PUT to S3
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  })
  if (!putRes.ok) throw new Error(`S3 upload failed (${putRes.status})`)
  return publicUrl
}

// ── Image uploader UI ────────────────────────────────────────────────────────

function ImageUploader({
  images, onChange,
}: { images: string[]; onChange: (next: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState('')

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true); setErr('')
    const next = [...images]
    for (const file of Array.from(files)) {
      try {
        const url = await uploadImage(file)
        next.push(url)
      } catch (e: any) {
        setErr(e.message || 'Upload failed')
      }
    }
    onChange(next)
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function removeAt(i: number) {
    onChange(images.filter((_, idx) => idx !== i))
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= images.length) return
    const next = [...images]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div>
      <label>Images</label>
      <div style={{
        border: '1px dashed #ccc', borderRadius: 4, padding: 12,
        background: '#fafafa', marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" className="btn btn-s btn-sm"
            onClick={() => inputRef.current?.click()} disabled={busy}>
            <Upload size={12} /> {busy ? 'Uploading…' : 'Add images'}
          </button>
          <span className="muted" style={{ fontSize: 12 }}>
            JPG/PNG/WebP. Resized + compressed automatically. First image is the main photo.
          </span>
        </div>
        <input ref={inputRef} type="file" accept="image/*" multiple
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)} />
        {err && <div className="alert alert-e" style={{ marginTop: 8 }}>{err}</div>}
      </div>

      {images.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
          gap: 8, marginBottom: 8,
        }}>
          {images.map((url, i) => (
            <div key={url + i} style={{
              position: 'relative', aspectRatio: '1 / 1', border: '1px solid #e5e5e5',
              borderRadius: 4, overflow: 'hidden', background: '#fff',
            }}>
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {i === 0 && (
                <span style={{
                  position: 'absolute', top: 3, left: 3, background: 'rgba(0,0,0,0.7)',
                  color: '#fff', fontSize: 9, padding: '2px 5px', borderRadius: 2,
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                }}>Main</span>
              )}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                display: 'flex', justifyContent: 'space-between',
                background: 'rgba(0,0,0,0.55)',
              }}>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                  style={{ flex: 1, background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 11, opacity: i === 0 ? 0.3 : 1 }}>‹</button>
                <button type="button" onClick={() => removeAt(i)}
                  style={{ flex: 1, background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 11 }}>×</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1}
                  style={{ flex: 1, background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 11, opacity: i === images.length - 1 ? 0.3 : 1 }}>›</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Collections multi-select chips ───────────────────────────────────────────

function CollectionsPicker({
  selected, onChange,
}: { selected: string[]; onChange: (next: string[]) => void }) {
  function toggle(name: string) {
    onChange(selected.includes(name)
      ? selected.filter((n) => n !== name)
      : [...selected, name])
  }
  return (
    <div>
      <label>Categories <span className="muted" style={{ fontSize: 11, fontWeight: 400 }}>(pick one or more)</span></label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {COLLECTIONS.map((c) => {
          const on = selected.includes(c)
          return (
            <button key={c} type="button" onClick={() => toggle(c)}
              style={{
                padding: '5px 11px', fontSize: 12, borderRadius: 14,
                border: on ? '1px solid #2b2b2b' : '1px solid #ddd',
                background: on ? '#2b2b2b' : '#fff',
                color: on ? '#fff' : '#444',
                cursor: 'pointer',
              }}>
              {c}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Products ─────────────────────────────────────────────────────────────────

const P0 = {
  name: '', slug: '', slugOverride: false,
  collections: [] as string[],
  description: '',
  priceINR: '', priceUSD: '',
  originalPriceINR: '', originalPriceUSD: '',
  stock: '',
  images: [] as string[],
  tags: '',
  inStock: true,
  featured: false,
}

function Products() {
  // Hydrate from cache synchronously so switching admin tabs feels instant
  // — no loading flash unless the cache is genuinely cold.
  const [list, setList] = useState<any[]>(() => getCachedProducts() || [])
  const [busy, setBusy] = useState<boolean>(() => !getCachedProducts())
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>(P0)
  const [eid, setEid]   = useState<string | null>(null)
  const [err, setErr]   = useState('')
  const [sav, setSav]   = useState(false)
  const [filter, setFilter] = useState('')

  const load = useCallback((opts: { force?: boolean } = {}) => {
    // Only show busy state on cold/forced loads; warm-cache reads complete
    // synchronously and don't need a spinner.
    const cached = getCachedProducts()
    if (!opts.force && cached) {
      setList(cached); setBusy(false); return
    }
    setBusy(true)
    fetchAllProducts(opts)
      .then((items) => setList(items))
      .catch(() => {})
      .finally(() => setBusy(false))
  }, [])

  useEffect(() => {
    // First mount: if we hydrated from cache there's nothing to do; otherwise
    // kick off the initial fetch.
    if (!getCachedProducts()) load()
  }, [load])

  function openNew() {
    setForm(P0); setEid(null); setErr(''); setModal(true)
  }

  function openEdit(p: any) {
    setForm({
      ...P0,
      ...p,
      slug: p.slug || '',
      slugOverride: true,                    // existing slug — don't auto-rewrite
      collections: Array.isArray(p.collections) ? p.collections : [],
      images:      Array.isArray(p.images)      ? p.images      : [],
      tags: (p.tags || []).join(', '),
    })
    setEid(p.id); setErr(''); setModal(true)
  }

  /** auto-update slug as the user types the name, unless they manually edited it */
  function setName(name: string) {
    setForm((p: any) => ({
      ...p,
      name,
      slug: p.slugOverride ? p.slug : toSlug(name),
    }))
  }

  async function save() {
    if (!form.name?.trim()) { setErr('Name is required'); return }
    if (form.collections.length === 0) { setErr('Pick at least one category'); return }

    setSav(true); setErr('')
    const finalSlug = (form.slug || toSlug(form.name)).trim()

    const body: any = {
      name:             form.name.trim(),
      slug:             finalSlug,
      description:      form.description || '',
      collections:      form.collections,
      priceINR:         parseFloat(form.priceINR) || 0,
      priceUSD:         parseFloat(form.priceUSD) || 0,
      originalPriceINR: parseFloat(form.originalPriceINR) || 0,
      originalPriceUSD: parseFloat(form.originalPriceUSD) || 0,
      stock:            parseInt(form.stock) || 0,
      images:           Array.isArray(form.images) ? form.images : [],
      tags:             form.tags
        ? form.tags.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [],
      inStock:  !!form.inStock,
      featured: !!form.featured,
      published: true,
    }

    try {
      const r = await fetch(`${API}/products${eid ? `/${eid}` : ''}`, {
        method: eid ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const text = await r.text()
        throw new Error(text || `Request failed (${r.status})`)
      }
      invalidateProductsCache()
      setModal(false); load({ force: true })
    } catch (e: any) {
      setErr(e.message || 'Failed')
    } finally { setSav(false) }
  }

  async function del(id: string) {
    if (!confirm('Delete product?')) return
    await fetch(`${API}/products/${id}`, { method: 'DELETE' })
    invalidateProductsCache()
    load({ force: true })
  }

  const f = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }))

  const filtered = filter
    ? list.filter((p) =>
        (p.name || '').toLowerCase().includes(filter.toLowerCase()) ||
        (p.slug || '').toLowerCase().includes(filter.toLowerCase()))
    : list

  return (
    <div>
      <div className="ph">
        <div>
          <h1>Products</h1>
          <p>{busy ? 'Loading…' : `${list.length} items`}{filter && !busy ? ` · ${filtered.length} match` : ''}</p>
        </div>
        <div className="flex gap2" style={{ alignItems: 'center' }}>
          <input value={filter} onChange={(e) => setFilter(e.target.value)}
            placeholder="Search by name or slug…"
            style={{ padding: '6px 10px', fontSize: 13, border: '1px solid #ddd', borderRadius: 4, width: 220 }} />
          <button className="btn btn-p" onClick={openNew}><Plus size={13} /> Add Product</button>
        </div>
      </div>

      <div className="card">
        {busy ? <div className="empty">Loading…</div>
          : filtered.length === 0 ? <div className="empty">{filter ? 'No products match that search.' : <>No products yet. <button className="btn btn-p btn-sm mt2" onClick={openNew}>Add one</button></>}</div>
          : <table>
              <thead>
                <tr>
                  <th></th><th>Name</th><th>Categories</th><th>₹ Price</th><th>Stock</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.images?.[0]
                        ? <img src={p.images[0]} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 3 }} />
                        : <div style={{ width: 36, height: 36, background: '#f0f0f0', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb' }}><ImageIcon size={14} /></div>}
                    </td>
                    <td><span className="trunc">{p.name}</span></td>
                    <td>
                      {(p.collections || []).slice(0, 2).map((c: string) =>
                        <span key={c} className="tag" style={{ marginRight: 4 }}>{c}</span>)}
                      {(p.collections || []).length > 2 &&
                        <span className="muted" style={{ fontSize: 11 }}>+{p.collections.length - 2}</span>}
                    </td>
                    <td>₹{p.priceINR?.toLocaleString()}</td>
                    <td>{p.stock ?? '—'}</td>
                    <td><span className={`b ${p.inStock ? 'b-g' : 'b-r'}`}>{p.inStock ? 'In Stock' : 'Out'}</span></td>
                    <td>
                      <div className="flex gap2">
                        <button className="btn btn-s btn-sm" onClick={() => openEdit(p)}><Pencil size={11} /></button>
                        <button className="btn btn-d btn-sm" onClick={() => del(p.id)}><Trash2 size={11} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>

      {modal && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-h">
              <h3>{eid ? 'Edit' : 'Add'} Product</h3>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={15} /></button>
            </div>
            <div className="modal-b">
              {err && <div className="alert alert-e">{err}</div>}

              <div className="fg">
                <label>Product name *</label>
                <input value={form.name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amethyst Healing Bracelet" />
                <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                  URL: <span style={{ fontFamily: 'monospace', color: '#666' }}>/shop/{form.slug || '...'}</span>
                  {!form.slugOverride && form.slug && (
                    <button type="button" onClick={() => f('slugOverride', true)}
                      style={{ marginLeft: 8, background: 'none', border: 'none', color: '#3366cc', fontSize: 11, cursor: 'pointer', padding: 0 }}>
                      Edit URL
                    </button>
                  )}
                </div>
                {form.slugOverride && (
                  <input value={form.slug} onChange={(e) => f('slug', e.target.value)}
                    placeholder="custom-url-slug"
                    style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 12 }} />
                )}
              </div>

              <CollectionsPicker
                selected={form.collections}
                onChange={(next) => f('collections', next)} />

              <div className="fg">
                <label>Description</label>
                <textarea value={form.description} onChange={(e) => f('description', e.target.value)} rows={3} />
              </div>

              <ImageUploader
                images={form.images}
                onChange={(next) => f('images', next)} />

              <div className="row2">
                <div className="fg"><label>Price ₹ *</label><input type="number" value={form.priceINR} onChange={(e) => f('priceINR', e.target.value)} /></div>
                <div className="fg"><label>Price $</label><input type="number" value={form.priceUSD} onChange={(e) => f('priceUSD', e.target.value)} /></div>
              </div>
              <div className="row2">
                <div className="fg"><label>Original ₹ (strikethrough)</label><input type="number" value={form.originalPriceINR} onChange={(e) => f('originalPriceINR', e.target.value)} /></div>
                <div className="fg"><label>Original $</label><input type="number" value={form.originalPriceUSD} onChange={(e) => f('originalPriceUSD', e.target.value)} /></div>
              </div>
              <div className="row2">
                <div className="fg"><label>Stock</label><input type="number" value={form.stock} onChange={(e) => f('stock', e.target.value)} /></div>
                <div className="fg"><label>Tags (comma-separated)</label><input value={form.tags} onChange={(e) => f('tags', e.target.value)} placeholder="amethyst, healing, protection" /></div>
              </div>

              <div className="flex gap2 mt2">
                <label className="check-row"><input type="checkbox" checked={form.inStock} onChange={(e) => f('inStock', e.target.checked)} /> In Stock</label>
                <label className="check-row" style={{ marginLeft: 12 }}><input type="checkbox" checked={form.featured} onChange={(e) => f('featured', e.target.checked)} /> Featured</label>
              </div>
            </div>
            <div className="modal-f">
              <button className="btn btn-s" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn btn-p" onClick={save} disabled={sav}>
                {sav ? 'Saving…' : eid ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Coupons ───────────────────────────────────────────────────────────────────
const C0 = { code:'',discountType:'percentage',discountValue:'',minOrderINR:'',maxUsage:'',expiresAt:'',active:true }

function Coupons() {
  const [list, setList] = useState<any[]>([])
  const [busy, setBusy] = useState(true)
  const [modal,setModal]= useState(false)
  const [form, setForm] = useState<any>(C0)
  const [err,  setErr]  = useState('')
  const [sav,  setSav]  = useState(false)

  const load = useCallback(()=>{
    setBusy(true)
    fetch(`${API}/coupons`).then(r=>r.json())
      .then(d=>{setList(Array.isArray(d)?d:d.coupons||[]);setBusy(false)})
      .catch(()=>setBusy(false))
  },[])

  useEffect(()=>{ load() },[load])

  async function save(){
    setSav(true); setErr('')
    const body = {...form, code:form.code.toUpperCase().trim(),
      discountValue:parseFloat(form.discountValue)||0,
      minOrderINR:parseFloat(form.minOrderINR)||0,
      maxUsage:form.maxUsage?parseInt(form.maxUsage):null,
    }
    try {
      const r = await fetch(`${API}/coupons`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      if(!r.ok) throw new Error(await r.text())
      setModal(false); setForm(C0); load()
    } catch(e:any){setErr(e.message||'Failed')} finally{setSav(false)}
  }

  async function toggle(c:any){
    await fetch(`${API}/coupons/${c.code}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:!c.active})})
    load()
  }

  async function del(code:string){
    if(!confirm(`Delete ${code}?`)) return
    await fetch(`${API}/coupons/${code}`,{method:'DELETE'}); load()
  }

  const f=(k:string,v:any)=>setForm((p:any)=>({...p,[k]:v}))

  return (
    <div>
      <div className="ph">
        <div><h1>Coupons</h1><p>{list.length} discount codes</p></div>
        <button className="btn btn-p" onClick={()=>{setForm(C0);setErr('');setModal(true)}}><Plus size={13}/> Add Coupon</button>
      </div>
      <div className="card">
        {busy ? <div className="empty">Loading…</div>
        : list.length===0 ? <div className="empty">No coupons yet.</div>
        : <table>
            <thead><tr><th>Code</th><th>Discount</th><th>Min Order</th><th>Usage</th><th>Expires</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {list.map(c=>(
                <tr key={c.code}>
                  <td><strong>{c.code}</strong></td>
                  <td>{c.discountType==='percentage'?`${c.discountValue}%`:`₹${c.discountValue}`}</td>
                  <td>{c.minOrderINR?`₹${c.minOrderINR}`:'—'}</td>
                  <td className="muted">{c.usageCount??0}{c.maxUsage?` / ${c.maxUsage}`:''}</td>
                  <td className="muted">{c.expiresAt?c.expiresAt.split('T')[0]:'No expiry'}</td>
                  <td><span className={`b ${c.active?'b-g':'b-n'}`}>{c.active?'Active':'Off'}</span></td>
                  <td><div className="flex gap2">
                    <button className="btn btn-s btn-sm" onClick={()=>toggle(c)}>{c.active?'Disable':'Enable'}</button>
                    <button className="btn btn-d btn-sm" onClick={()=>del(c.code)}><Trash2 size={11}/></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      </div>

      {modal&&(
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal">
            <div className="modal-h"><h3>Add Coupon</h3><button onClick={()=>setModal(false)} style={{background:'none',border:'none',cursor:'pointer'}}><X size={15}/></button></div>
            <div className="modal-b">
              {err&&<div className="alert alert-e">{err}</div>}
              <div className="row2">
                <div className="fg"><label>Code *</label><input value={form.code} onChange={e=>f('code',e.target.value.toUpperCase())} placeholder="SAVE20" style={{textTransform:'uppercase'}}/></div>
                <div className="fg"><label>Type</label>
                  <select value={form.discountType} onChange={e=>f('discountType',e.target.value)}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>
              </div>
              <div className="row2">
                <div className="fg"><label>Value *</label><input type="number" value={form.discountValue} onChange={e=>f('discountValue',e.target.value)}/></div>
                <div className="fg"><label>Min Order ₹</label><input type="number" value={form.minOrderINR} onChange={e=>f('minOrderINR',e.target.value)}/></div>
              </div>
              <div className="row2">
                <div className="fg"><label>Max Uses (blank=unlimited)</label><input type="number" value={form.maxUsage} onChange={e=>f('maxUsage',e.target.value)}/></div>
                <div className="fg"><label>Expires (blank=never)</label><input type="date" value={form.expiresAt} onChange={e=>f('expiresAt',e.target.value)}/></div>
              </div>
              <label className="check-row mt2"><input type="checkbox" checked={form.active} onChange={e=>f('active',e.target.checked)}/> Active immediately</label>
            </div>
            <div className="modal-f">
              <button className="btn btn-s" onClick={()=>setModal(false)}>Cancel</button>
              <button className="btn btn-p" onClick={save} disabled={sav}>{sav?'Saving…':'Create Coupon'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Orders ────────────────────────────────────────────────────────────────────
function Orders() {
  const [list, setList] = useState<any[]>([])
  const [busy, setBusy] = useState(true)

  useEffect(()=>{
    fetch(`${API}/orders`).then(r=>r.json())
      .then(d=>{ setList(Array.isArray(d)?d:d.orders||[]); setBusy(false) })
      .catch(()=>setBusy(false))
  },[])

  const STATUS_COLOR: Record<string,string> = {
    paid:'b-g', pending:'b-y', failed:'b-r', refunded:'b-u'
  }

  return (
    <div>
      <div className="ph"><div><h1>Orders</h1><p>{list.length} total</p></div></div>
      <div className="card">
        {busy ? <div className="empty">Loading…</div>
        : list.length===0 ? <div className="empty">No orders yet.</div>
        : <table>
            <thead><tr><th>Order ID</th><th>Customer</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {list.map(o=>(
                <tr key={o.id}>
                  <td className="muted" style={{fontFamily:'monospace',fontSize:12}}>{o.id?.slice(-8)}</td>
                  <td>
                    <div>{o.customerName||'—'}</div>
                    <div className="muted">{o.customerEmail}</div>
                  </td>
                  <td>{o.currency==='INR'?`₹${o.total?.toLocaleString()}`:`$${o.total}`}</td>
                  <td><span className={`b ${STATUS_COLOR[o.status]||'b-n'}`}>{o.status}</span></td>
                  <td className="muted">{o.createdAt?o.createdAt.split('T')[0]:'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      </div>
    </div>
  )
}

// ── Shop page (tabs) ──────────────────────────────────────────────────────────
export default function ShopPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'products'|'coupons'|'orders'>('products')

  useEffect(()=>{
    const t = router.query.t as string
    if(t==='orders') setTab('orders')
    if(router.query.new==='coupon') setTab('coupons')
  },[router.query])

  return (
    <Shell title="Shop">
      <div className="tabs">
        {(['products','coupons','orders'] as const).map(t=>(
          <div key={t} className={`tab ${tab===t?'on':''}`} onClick={()=>setTab(t)}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </div>
        ))}
      </div>
      {tab==='products' && <Products/>}
      {tab==='coupons'  && <Coupons/>}
      {tab==='orders'   && <Orders/>}
    </Shell>
  )
}
