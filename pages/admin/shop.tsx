import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import Shell from '@/components/Shell'
import { Plus, Pencil, Trash2, X } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const CATS = [
  'Bracelets','Zodiac Bracelets','Therapy Bracelets','Raw/Rough Stones','Tumble Stones',
  'Crystal Clusters','Towers/Wands/Pencils','Balls/Spheres','Pyramids','Puffy Hearts',
  'Palm Stones','Crystal Tree','Rollers/Gua Sha','Pendants/Jewellery','Angels',
  'Idols/Figurines','Evil Eye Products','Jap Mala','Rudraksh','Feng Shui','Dowsers',
  'Energy Generator Orgones','Intention Coin','Sage/Incense','Cleansing/Charging',
  'Meditation Essentials','Energized Water','Lamp',
]

// ── Products ─────────────────────────────────────────────────────────────────
const P0 = { name:'',slug:'',category:CATS[0],description:'',
  priceINR:'',priceUSD:'',originalPriceINR:'',originalPriceUSD:'',
  stock:'',images:'',tags:'',inStock:true,featured:false }

function Products() {
  const [list, setList] = useState<any[]>([])
  const [busy, setBusy] = useState(true)
  const [modal,setModal]= useState(false)
  const [form, setForm] = useState<any>(P0)
  const [eid,  setEid]  = useState<string|null>(null)
  const [err,  setErr]  = useState('')
  const [sav,  setSav]  = useState(false)

  const load = useCallback(() => {
    setBusy(true)
    fetch(`${API}/products?published_only=false`)
      .then(r=>r.json()).then(d=>{ setList(d.products||d||[]); setBusy(false) })
      .catch(()=>setBusy(false))
  },[])

  useEffect(()=>{ load() },[load])

  function openNew(){ setForm(P0); setEid(null); setErr(''); setModal(true) }
  function openEdit(p:any){
    setForm({...p,images:(p.images||[]).join(', '),tags:(p.tags||[]).join(', ')})
    setEid(p.id); setErr(''); setModal(true)
  }

  async function save(){
    setSav(true); setErr('')
    const body = { ...form,
      priceINR:parseFloat(form.priceINR)||0, priceUSD:parseFloat(form.priceUSD)||0,
      originalPriceINR:parseFloat(form.originalPriceINR)||0,
      originalPriceUSD:parseFloat(form.originalPriceUSD)||0,
      stock:parseInt(form.stock)||0,
      images:form.images?form.images.split(',').map((s:string)=>s.trim()).filter(Boolean):[],
      tags:  form.tags  ?form.tags.split(',').map((s:string)=>s.trim()).filter(Boolean):[],
    }
    try {
      const r = await fetch(`${API}/products${eid?`/${eid}`:''}`,{
        method:eid?'PUT':'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body),
      })
      if(!r.ok) throw new Error(await r.text())
      setModal(false); load()
    } catch(e:any){ setErr(e.message||'Failed') } finally { setSav(false) }
  }

  async function del(id:string){
    if(!confirm('Delete product?')) return
    await fetch(`${API}/products/${id}`,{method:'DELETE'}); load()
  }

  const f=(k:string,v:any)=>setForm((p:any)=>({...p,[k]:v}))

  return (
    <div>
      <div className="ph">
        <div><h1>Products</h1><p>{list.length} items</p></div>
        <button className="btn btn-p" onClick={openNew}><Plus size={13}/> Add Product</button>
      </div>
      <div className="card">
        {busy ? <div className="empty">Loading…</div>
        : list.length===0 ? <div className="empty">No products yet. <button className="btn btn-p btn-sm mt2" onClick={openNew}>Add one</button></div>
        : <table>
            <thead><tr><th>Name</th><th>Category</th><th>₹ Price</th><th>Stock</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {list.map(p=>(
                <tr key={p.id}>
                  <td><span className="trunc">{p.name}</span></td>
                  <td><span className="tag">{p.category}</span></td>
                  <td>₹{p.priceINR?.toLocaleString()}</td>
                  <td>{p.stock??'—'}</td>
                  <td><span className={`b ${p.inStock?'b-g':'b-r'}`}>{p.inStock?'In Stock':'Out'}</span></td>
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
          <div className="modal">
            <div className="modal-h">
              <h3>{eid?'Edit':'Add'} Product</h3>
              <button onClick={()=>setModal(false)} style={{background:'none',border:'none',cursor:'pointer'}}><X size={15}/></button>
            </div>
            <div className="modal-b">
              {err&&<div className="alert alert-e">{err}</div>}
              <div className="row2">
                <div className="fg"><label>Name *</label><input value={form.name} onChange={e=>f('name',e.target.value)}/></div>
                <div className="fg"><label>Slug *</label><input value={form.slug} onChange={e=>f('slug',e.target.value)} placeholder="amethyst-bracelet"/></div>
              </div>
              <div className="fg"><label>Category</label>
                <select value={form.category} onChange={e=>f('category',e.target.value)}>
                  {CATS.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="fg"><label>Description</label>
                <textarea value={form.description} onChange={e=>f('description',e.target.value)} rows={3}/>
              </div>
              <div className="row2">
                <div className="fg"><label>Price ₹</label><input type="number" value={form.priceINR} onChange={e=>f('priceINR',e.target.value)}/></div>
                <div className="fg"><label>Price $</label><input type="number" value={form.priceUSD} onChange={e=>f('priceUSD',e.target.value)}/></div>
              </div>
              <div className="row2">
                <div className="fg"><label>Original ₹ (strikethrough)</label><input type="number" value={form.originalPriceINR} onChange={e=>f('originalPriceINR',e.target.value)}/></div>
                <div className="fg"><label>Original $</label><input type="number" value={form.originalPriceUSD} onChange={e=>f('originalPriceUSD',e.target.value)}/></div>
              </div>
              <div className="row2">
                <div className="fg"><label>Stock</label><input type="number" value={form.stock} onChange={e=>f('stock',e.target.value)}/></div>
                <div className="fg"><label>Images (comma-separated URLs)</label><input value={form.images} onChange={e=>f('images',e.target.value)}/></div>
              </div>
              <div className="fg"><label>Tags (comma-separated)</label>
                <input value={form.tags} onChange={e=>f('tags',e.target.value)} placeholder="healing, protection"/>
              </div>
              <div className="flex gap2 mt2">
                <label className="check-row"><input type="checkbox" checked={form.inStock} onChange={e=>f('inStock',e.target.checked)}/> In Stock</label>
                <label className="check-row" style={{marginLeft:12}}><input type="checkbox" checked={form.featured} onChange={e=>f('featured',e.target.checked)}/> Featured</label>
              </div>
            </div>
            <div className="modal-f">
              <button className="btn btn-s" onClick={()=>setModal(false)}>Cancel</button>
              <button className="btn btn-p" onClick={save} disabled={sav}>{sav?'Saving…':eid?'Save Changes':'Add Product'}</button>
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
