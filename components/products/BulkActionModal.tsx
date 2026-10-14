// Bulk edit: pick an action, preview before → after, then apply as one undoable change.
import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import {
  BulkOp, Rounding, computeOp, describeOp, sendChanges, fmtVal, FIELD_LABEL, P, SendResult,
} from '@/lib/productTools'

type Kind = BulkOp['kind']
const ACTIONS: { v: Kind; l: string; group: string }[] = [
  { v: 'price', l: 'Change price', group: 'Price' },
  { v: 'clearSale', l: 'Remove "was" price (end sale)', group: 'Price' },
  { v: 'stock', l: 'Change stock quantity', group: 'Stock' },
  { v: 'inStock', l: 'Mark in stock / out of stock', group: 'Stock' },
  { v: 'catAdd', l: 'Add to category', group: 'Organise' },
  { v: 'catRemove', l: 'Remove from category', group: 'Organise' },
  { v: 'tagAdd', l: 'Add tag', group: 'Organise' },
  { v: 'tagRemove', l: 'Remove tag', group: 'Organise' },
  { v: 'ribbon', l: 'Set or remove ribbon', group: 'Organise' },
  { v: 'published', l: 'Show / hide on website', group: 'Visibility' },
  { v: 'featured', l: 'Featured on / off', group: 'Visibility' },
  { v: 'bestseller', l: 'Bestseller on / off', group: 'Visibility' },
  { v: 'delete', l: 'Delete products', group: 'Danger' },
]
const FLAG_YES: Record<string, string> = { inStock: 'In stock', published: 'Visible on website', featured: 'Featured', bestseller: 'Bestseller' }
const FLAG_NO: Record<string, string> = { inStock: 'Out of stock', published: 'Hidden', featured: 'Not featured', bestseller: 'Not bestseller' }

export default function BulkActionModal({ products, categories, onClose, onDone }: {
  products: P[]; categories: string[]; onClose: () => void; onDone: (r: SendResult, label: string) => void
}) {
  const [kind, setKind] = useState<Kind>('price')
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR')
  const [mode, setMode] = useState<'set' | 'pct_up' | 'pct_down' | 'amt_up' | 'amt_down'>('pct_up')
  const [value, setValue] = useState('')
  const [rounding, setRounding] = useState<Rounding>('none')
  const [keepWas, setKeepWas] = useState(false)
  const [stockMode, setStockMode] = useState<'set' | 'add'>('set')
  const [flag, setFlag] = useState(true)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [err, setErr] = useState('')

  const op: BulkOp | null = useMemo(() => {
    const n = parseFloat(value)
    switch (kind) {
      case 'price': return isFinite(n) && n >= 0 ? { kind, currency, mode, value: n, rounding, keepWas } : null
      case 'stock': return isFinite(n) && (stockMode === 'add' || n >= 0) ? { kind, mode: stockMode, value: Math.round(n) } : null
      case 'inStock': case 'published': case 'featured': case 'bestseller': return { kind, value: flag }
      case 'catAdd': case 'catRemove': case 'tagAdd': case 'tagRemove':
        return text.trim() ? { kind, value: text.trim() } : null
      case 'ribbon': return { kind, value: text.trim() }
      case 'clearSale': return { kind }
      case 'delete': return { kind }
    }
  }, [kind, currency, mode, value, rounding, keepWas, stockMode, flag, text])

  const plan = useMemo(() => {
    if (!op) return []
    const out: { p: P; set: Record<string, any> }[] = []
    for (const p of products) { const set = computeOp(p, op); if (set) out.push({ p, set }) }
    return out
  }, [products, op])

  async function apply() {
    if (!op || !plan.length) return
    if (op.kind === 'delete' && !confirm(`Delete ${plan.length} products? You can undo this from History for 7 days.`)) return
    setBusy(true); setErr('')
    const label = `${describeOp(op)} · ${plan.length} product${plan.length > 1 ? 's' : ''}`
    try {
      const r = await sendChanges({ label, source: 'bulk', updates: plan.map(({ p, set }) => ({ id: p.id, set })) },
        (d, t) => setProgress(`Saving ${d} / ${t}…`))
      onDone(r, label)
    } catch (e: any) { setErr(e.message || 'Failed') } finally { setBusy(false); setProgress('') }
  }

  const sym = currency === 'INR' ? '₹' : '$'
  const row = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal" style={{ maxWidth: 720 }}>
        <div className="modal-h">
          <h3>Bulk edit {products.length} product{products.length > 1 ? 's' : ''}</h3>
          <button onClick={onClose} disabled={busy} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={15} /></button>
        </div>
        <div className="modal-b">
          {err && <div className="alert alert-e">{err}</div>}
          <div className="fg">
            <label>What do you want to change?</label>
            <select value={kind} onChange={(e) => { setKind(e.target.value as Kind); setText(''); setValue('') }}>
              {['Price', 'Stock', 'Organise', 'Visibility', 'Danger'].map((g) => (
                <optgroup key={g} label={g}>
                  {ACTIONS.filter((a) => a.group === g).map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          {kind === 'price' && (
            <div className="fg">
              <div style={row}>
                <select value={currency} onChange={(e) => { setCurrency(e.target.value as any); setRounding('none') }} style={{ width: 110 }}>
                  <option value="INR">₹ INR</option><option value="USD">$ USD</option>
                </select>
                <select value={mode} onChange={(e) => setMode(e.target.value as any)} style={{ width: 170 }}>
                  <option value="pct_up">Increase by %</option><option value="pct_down">Decrease by %</option>
                  <option value="amt_up">Increase by {sym}</option><option value="amt_down">Decrease by {sym}</option>
                  <option value="set">Set exact price</option>
                </select>
                <input type="number" min={0} step="any" value={value} onChange={(e) => setValue(e.target.value)}
                  placeholder={mode.startsWith('pct') ? 'e.g. 10' : 'e.g. 100'} style={{ width: 110 }} autoFocus />
                <select value={rounding} onChange={(e) => setRounding(e.target.value as Rounding)} style={{ width: 200 }}>
                  <option value="none">No rounding</option>
                  {currency === 'INR' ? <>
                    <option value="whole">Round to whole ₹</option>
                    <option value="9">Round to end in 9 (₹989)</option>
                    <option value="99">Round to end in 99 (₹999)</option>
                  </> : <>
                    <option value="whole">Round to whole $</option>
                    <option value=".99">Round to .99 ($24.99)</option>
                  </>}
                </select>
              </div>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10, fontWeight: 400, textTransform: 'none', fontSize: 12, color: '#444' }}>
                <input type="checkbox" checked={keepWas} onChange={(e) => setKeepWas(e.target.checked)} style={{ width: 'auto' }} />
                Show the old price as the &quot;was&quot; price (strike-through) when the price goes down
              </label>
            </div>
          )}

          {kind === 'stock' && (
            <div className="fg" style={row}>
              <select value={stockMode} onChange={(e) => setStockMode(e.target.value as any)} style={{ width: 240 }}>
                <option value="set">Set stock to</option><option value="add">Add / subtract (use −5 to reduce)</option>
              </select>
              <input type="number" step={1} value={value} onChange={(e) => setValue(e.target.value)} style={{ width: 110 }} autoFocus />
            </div>
          )}

          {(kind === 'inStock' || kind === 'published' || kind === 'featured' || kind === 'bestseller') && (
            <div className="fg">
              <select value={flag ? 'y' : 'n'} onChange={(e) => setFlag(e.target.value === 'y')} style={{ width: 240 }}>
                <option value="y">{FLAG_YES[kind]}</option>
                <option value="n">{FLAG_NO[kind]}</option>
              </select>
            </div>
          )}

          {(kind === 'catAdd' || kind === 'catRemove') && (
            <div className="fg">
              <select value={text} onChange={(e) => setText(e.target.value)}>
                <option value="">Choose a category…</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          {(kind === 'tagAdd' || kind === 'tagRemove' || kind === 'ribbon') && (
            <div className="fg">
              <input value={text} onChange={(e) => setText(e.target.value)} autoFocus
                placeholder={kind === 'ribbon' ? 'e.g. New, Sale, Diwali Special (leave empty to remove)' : 'Tag, e.g. rose quartz'} />
            </div>
          )}
          {kind === 'delete' && <div className="alert alert-e">The selected products will be removed from the website. You can undo this from History for 7 days.</div>}

          <div style={{ fontSize: 12, color: '#666', margin: '6px 0 8px' }}>
            {op ? <><strong>{plan.length}</strong> of {products.length} products will change
              {products.length - plan.length > 0 && <> · {products.length - plan.length} already match</>}</> : 'Fill in the value to see a preview.'}
          </div>
          {op && plan.length > 0 && kind !== 'delete' && (
            <div style={{ border: '1px solid #eee', borderRadius: 4, maxHeight: 240, overflow: 'auto' }}>
              <table>
                <thead><tr><th>Product</th><th>Change</th></tr></thead>
                <tbody>
                  {plan.slice(0, 30).map(({ p, set }) => (
                    <tr key={p.id}>
                      <td style={{ maxWidth: 260 }}><span className="trunc">{p.name}</span></td>
                      <td style={{ fontSize: 12 }}>
                        {Object.entries(set).map(([k, v]) => (
                          <div key={k}><span className="muted">{FIELD_LABEL[k] || k}:</span> {fmtVal(k, p[k])} → <strong>{fmtVal(k, v)}</strong></div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {plan.length > 30 && <p className="muted" style={{ padding: '6px 12px' }}>…and {plan.length - 30} more</p>}
            </div>
          )}
        </div>
        <div className="modal-f" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="muted">{progress || 'You can undo this from History for 7 days.'}</span>
          <div className="flex gap2">
            <button className="btn btn-s" onClick={onClose} disabled={busy}>Cancel</button>
            <button className={`btn ${kind === 'delete' ? 'btn-d' : 'btn-p'}`} onClick={apply} disabled={busy || !op || !plan.length}>
              {busy ? 'Saving…' : kind === 'delete' ? `Delete ${plan.length}` : `Apply to ${plan.length}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
