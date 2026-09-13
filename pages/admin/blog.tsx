import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import Shell from '@/components/Shell'
import { Plus, Pencil, Trash2, X, Eye, EyeOff, Upload } from 'lucide-react'
import { authedFetch } from '@/lib/auth'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const CATS = ['Tarot & Divination','Crystals & Gemstones','Spiritual Healing',
  'Energy Work','Meditation','Manifestation','Astrology','General']

const B0 = { title:'',slug:'',category:CATS[0],excerpt:'',content:'',
  coverImage:'',readTime:5,tags:'',published:true,seoTitle:'',seoDesc:'' }

// ── image upload (same pre-signed S3 flow as Shop / Carousel pages) ────────

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
  return { blob, contentType: 'image/jpeg', filename: `${base || 'post'}.jpg` }
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

export default function BlogPage() {
  const router = useRouter()
  const [posts, setPosts] = useState<any[]>([])
  const [busy,  setBusy]  = useState(true)
  const [modal, setModal] = useState(false)
  const [form,  setForm]  = useState<any>(B0)
  const [eid,   setEid]   = useState<string|null>(null)
  const [err,   setErr]   = useState('')
  const [sav,   setSav]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(()=>{
    setBusy(true)
    fetch(`${API}/blog?published_only=false`)
      .then(r=>r.json()).then(d=>{ setPosts(d.posts||d||[]); setBusy(false) })
      .catch(()=>setBusy(false))
  },[])

  useEffect(()=>{ load(); if(router.query.new) openNew() },[load])

  function openNew(){ setForm(B0); setEid(null); setErr(''); setModal(true) }
  function openEdit(p:any){
    setForm({...p, tags:(p.tags||[]).join(', ')})
    setEid(p.id); setErr(''); setModal(true)
  }

  async function save(){
    setSav(true); setErr('')
    const body = { ...form,
      readTime: parseInt(form.readTime)||5,
      tags: form.tags?form.tags.split(',').map((s:string)=>s.trim()).filter(Boolean):[],
      seoTitle: form.seoTitle||form.title,
      seoDesc:  form.seoDesc||form.excerpt,
    }
    try {
      const url = eid ? `${API}/blog/${eid}` : `${API}/blog`
      // Admin-only write — must carry the JWT.
      const r = await authedFetch(url,{method:eid?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      if(!r.ok) throw new Error(await r.text())
      setModal(false); load()
    } catch(e:any){setErr(e.message||'Failed')} finally{setSav(false)}
  }

  async function togglePublish(p:any){
    // Admin-only write — must carry the JWT.
    await authedFetch(`${API}/blog/${p.id}`,{method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({published:!p.published})})
    load()
  }

  async function del(id:string){
    if(!confirm('Delete this post?')) return
    // Admin-only write — must carry the JWT.
    await authedFetch(`${API}/blog/${id}`,{method:'DELETE'}); load()
  }

  const f=(k:string,v:any)=>setForm((p:any)=>({...p,[k]:v}))

  async function handleCoverFile(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true); setUploadErr('')
    try {
      const url = await uploadImage(files[0])
      f('coverImage', url)
    } catch (e:any) {
      setUploadErr(e.message || 'Upload failed')
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function formatDate(iso:string){ try { return new Date(iso).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) } catch{return''} }

  return (
    <Shell title="Blog">
      <div className="ph">
        <div><h1>Blog Posts</h1><p>{posts.length} articles</p></div>
        <button className="btn btn-p" onClick={openNew}><Plus size={13}/> New Post</button>
      </div>

      <div className="card">
        {busy ? <div className="empty">Loading…</div>
        : posts.length===0 ? <div className="empty">No posts yet. <button className="btn btn-p btn-sm mt2" onClick={openNew}>Write first post</button></div>
        : <table>
            <thead><tr><th>Title</th><th>Category</th><th>Read Time</th><th>Published</th><th>Date</th><th></th></tr></thead>
            <tbody>
              {posts.map(p=>(
                <tr key={p.id}>
                  <td><span className="trunc" style={{maxWidth:240}}>{p.title}</span></td>
                  <td><span className="tag">{p.category}</span></td>
                  <td className="muted">{p.readTime} min</td>
                  <td>
                    <button className={`b ${p.published?'b-g':'b-n'}`}
                      onClick={()=>togglePublish(p)} style={{cursor:'pointer',border:'none',background:'transparent',display:'inline-flex',alignItems:'center',gap:4}}>
                      {p.published?<><Eye size={10}/> Live</>:<><EyeOff size={10}/> Draft</>}
                    </button>
                  </td>
                  <td className="muted">{formatDate(p.createdAt)}</td>
                  <td><div className="flex gap2">
                    <button className="btn btn-s btn-sm" onClick={()=>openEdit(p)}><Pencil size={11}/></button>
                    <button className="btn btn-d btn-sm" onClick={()=>del(p.id)}><Trash2 size={11}/></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      </div>

      {modal&&(
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal" style={{maxWidth:640}}>
            <div className="modal-h">
              <h3>{eid?'Edit Post':'New Post'}</h3>
              <button onClick={()=>setModal(false)} style={{background:'none',border:'none',cursor:'pointer'}}><X size={15}/></button>
            </div>
            <div className="modal-b">
              {err&&<div className="alert alert-e">{err}</div>}
              <div className="fg"><label>Title *</label><input value={form.title} onChange={e=>f('title',e.target.value)}/></div>
              <div className="row2">
                <div className="fg"><label>Slug *</label><input value={form.slug} onChange={e=>f('slug',e.target.value)} placeholder="how-tarot-works"/></div>
                <div className="fg"><label>Category</label>
                  <select value={form.category} onChange={e=>f('category',e.target.value)}>
                    {CATS.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="fg"><label>Excerpt (shown in listing cards) *</label>
                <textarea value={form.excerpt} onChange={e=>f('excerpt',e.target.value)} rows={2}/>
              </div>
              <div className="fg"><label>Content (HTML) *</label>
                <textarea value={form.content} onChange={e=>f('content',e.target.value)} rows={10}
                  style={{fontFamily:'monospace',fontSize:12}}
                  placeholder='<p>Start writing...</p>&#10;<h2>Section heading</h2>&#10;<p>More content...</p>'/>
              </div>
              <div className="fg">
                <label>Cover Image</label>
                <div style={{border:'1px dashed #ccc',borderRadius:4,padding:12,background:'#fafafa',marginBottom:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <button type="button" className="btn btn-s btn-sm" onClick={()=>fileRef.current?.click()} disabled={uploading}>
                      <Upload size={12}/> {uploading?'Uploading…':form.coverImage?'Replace image':'Upload image'}
                    </button>
                    <span className="muted" style={{fontSize:12}}>Shown on listing cards and at the top of the post. Recommended ~1200×675px (16:9).</span>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>handleCoverFile(e.target.files)} />
                  {uploadErr && <div className="alert alert-e" style={{marginTop:8}}>{uploadErr}</div>}
                </div>
                {form.coverImage && (
                  <div style={{position:'relative',width:'100%',height:140,borderRadius:4,overflow:'hidden',marginBottom:8}}>
                    <img src={form.coverImage} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    <button type="button" onClick={()=>f('coverImage','')}
                      style={{position:'absolute',top:4,right:4,background:'rgba(0,0,0,0.6)',color:'#fff',
                        border:'none',borderRadius:3,padding:'2px 8px',fontSize:11,cursor:'pointer'}}>
                      Remove
                    </button>
                  </div>
                )}
              </div>
              <div className="fg"><label>Read Time (minutes)</label><input type="number" value={form.readTime} onChange={e=>f('readTime',e.target.value)}/></div>
              <div className="fg"><label>Tags (comma-separated)</label><input value={form.tags} onChange={e=>f('tags',e.target.value)} placeholder="tarot, beginners, spirituality"/></div>
              <div className="row2">
                <div className="fg"><label>SEO Title (optional)</label><input value={form.seoTitle} onChange={e=>f('seoTitle',e.target.value)}/></div>
                <div className="fg"><label>SEO Description (optional)</label><input value={form.seoDesc} onChange={e=>f('seoDesc',e.target.value)}/></div>
              </div>
              <label className="check-row mt2"><input type="checkbox" checked={form.published} onChange={e=>f('published',e.target.checked)}/> Publish immediately</label>
            </div>
            <div className="modal-f">
              <button className="btn btn-s" onClick={()=>setModal(false)}>Cancel</button>
              <button className="btn btn-p" onClick={save} disabled={sav}>{sav?'Saving…':eid?'Save Changes':'Publish Post'}</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  )
}
