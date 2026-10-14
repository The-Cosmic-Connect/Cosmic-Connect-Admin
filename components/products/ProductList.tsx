// Admin product list: filters, sorting, pages, selection, inline quick edits,
// bulk edit, spreadsheet export/import and change history with undo.
import { ReactNode, useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Image as ImageIcon, Download, Upload, History, Search, X } from 'lucide-react'
import {
  P, Filters, EMPTY_FILTERS, STOCK_OPTS, VIS_OPTS, FLAG_OPTS, ISSUE_OPTS, SORTS,
  applyFilters, sortList, matchStock, matchFlag, matchIssue, isPublished, num,
  sendChanges, downloadCsv, SendResult,
} from '@/lib/productTools'
import BulkActionModal from './BulkActionModal'
import ImportModal from './ImportModal'
import HistoryModal from './HistoryModal'

const PAGE_SIZES = [25, 50, 100]
const NUM_FIELDS = ['priceINR', 'originalPriceINR', 'priceUSD', 'stock'] as const
type Edits = Record<string, Record<string, any>>

export default function ProductList({ list, busy, categories, onAdd, onEdit, onDelete, onChanged, onLocalUpdate, children }: {
  list: P[]; busy: boolean; categories: string[]
  onAdd: () => void; onEdit: (p: P) => void; onDelete: (id: string) => void
  onChanged: () => void                                 // refetch from the server
  onLocalUpdate: (patch: Record<string, Record<string, any>>) => void   // optimistic merge
  children?: ReactNode
}) {
  const [f, setF] = useState<Filters>(EMPTY_FILTERS)
  const [sort, setSort] = useState('updated')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [edits, setEdits] = useState<Edits>({})
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState<'bulk' | 'import' | 'history' | null>(null)
  const [note, setNote] = useState<{ kind: 's' | 'e'; text: string; details?: string[] } | null>(null)

  const allCats = useMemo(() => {
    const s = new Set(categories)
    list.forEach((p) => (p.collections || []).forEach((c: string) => s.add(c)))
    return Array.from(s)
  }, [list, categories])

  const filtered = useMemo(() => sortList(applyFilters(list, f), sort), [list, f, sort])
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const cur = Math.min(page, pages)
  const pageItems = filtered.slice((cur - 1) * pageSize, cur * pageSize)
  const active = Object.entries(f).some(([, v]) => v !== '')

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const p of list) {
      STOCK_OPTS.forEach((o) => { if (matchStock(p, o.v)) c['s' + o.v] = (c['s' + o.v] || 0) + 1 })
      FLAG_OPTS.forEach((o) => { if (matchFlag(p, o.v)) c['f' + o.v] = (c['f' + o.v] || 0) + 1 })
      ISSUE_OPTS.forEach((o) => { if (matchIssue(p, o.v)) c['i' + o.v] = (c['i' + o.v] || 0) + 1 })
      if (isPublished(p)) c.vpublished = (c.vpublished || 0) + 1; else c.vhidden = (c.vhidden || 0) + 1
      const cs = p.collections || []
      if (!cs.length) c['c__none__'] = (c['c__none__'] || 0) + 1
      cs.forEach((x: string) => { c['c' + x] = (c['c' + x] || 0) + 1 })
    }
    return c
  }, [list])

  const nEdits = Object.keys(edits).length
  useEffect(() => {                                    // warn before leaving with unsaved quick edits
    if (!nEdits) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [nEdits])

  function setFilter(k: keyof Filters, v: string) { setF((x) => ({ ...x, [k]: v })); setPage(1) }

  // ── selection ──
  const pageAllSel = pageItems.length > 0 && pageItems.every((p) => sel.has(p.id))
  function togglePage() {
    setSel((s) => { const n = new Set(s); pageItems.forEach((p) => (pageAllSel ? n.delete(p.id) : n.add(p.id))); return n })
  }
  function toggle(id: string) { setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  const selected = useMemo(() => list.filter((p) => sel.has(p.id)), [list, sel])

  // ── inline quick edits ──
  const val = (p: P, k: string) => (edits[p.id] && k in edits[p.id] ? edits[p.id][k] : k === 'published' ? isPublished(p) : p[k])
  function setEdit(p: P, k: string, v: any) {
    setEdits((e) => {
      const orig = k === 'published' ? isPublished(p) : p[k]
      const row = { ...(e[p.id] || {}) }
      const unchanged = typeof v === 'boolean' ? v === !!orig : v !== '' && num(v) === num(orig) && !isNaN(Number(v))
      if (unchanged) delete row[k]; else row[k] = v
      const next = { ...e }
      if (Object.keys(row).length) next[p.id] = row; else delete next[p.id]
      return next
    })
  }
  async function saveEdits() {
    const updates: { id: string; set: Record<string, any> }[] = []
    for (const [id, row] of Object.entries(edits)) {
      const set: Record<string, any> = {}
      for (const [k, v] of Object.entries(row)) {
        if (typeof v === 'boolean') { set[k] = v; continue }
        const n = Number(String(v).replace(/[₹$,\s]/g, ''))
        if (String(v).trim() === '' || !isFinite(n) || n < 0 || (k === 'stock' && !Number.isInteger(n))) {
          const p = list.find((x) => x.id === id)
          setNote({ kind: 'e', text: `"${v}" isn't a valid ${k === 'stock' ? 'stock number' : 'price'} for ${p?.name || 'a product'}` })
          return
        }
        set[k] = n
      }
      updates.push({ id, set })
    }
    setSaving(true); setNote(null)
    try {
      const r = await sendChanges({ label: `Quick edits · ${updates.length} product${updates.length > 1 ? 's' : ''}`, source: 'inline', updates })
      onLocalUpdate(Object.fromEntries(updates.map((u) => [u.id, u.set])))
      setEdits({})
      report(r, 'Quick edits saved')
      onChanged()
    } catch (e: any) { setNote({ kind: 'e', text: e.message || 'Save failed' }) } finally { setSaving(false) }
  }

  function report(r: SendResult, label: string) {
    const parts = [r.updated && `${r.updated} updated`, r.created && `${r.created} created`].filter(Boolean).join(', ') || 'no changes'
    const details = r.errors.slice(0, 20).map((e: any) => `${e.row ? `Row ${e.row}` : list.find((p) => p.id === e.id)?.name || e.id}: ${e.error}`)
    setNote({ kind: r.errors.length ? 'e' : 's', text: `${label}: ${parts}${r.errors.length ? ` · ${r.errors.length} failed` : ''}. Undo from History if needed.`, details })
  }
  function done(r: SendResult, label: string) {
    setModal(null); setSel(new Set()); report(r, label); onChanged()
  }

  function exportCsv(items: P[], suffix: string) {
    const d = new Date().toISOString().slice(0, 10)
    downloadCsv(items, `products-${d}${suffix}.csv`)
  }

  const sel_ = { padding: '6px 8px', fontSize: 12, width: 'auto', maxWidth: 190 }
  const cellIn = (p: P, k: string, w = 74) => {
    const edited = edits[p.id] && k in edits[p.id]
    return (
      <input value={val(p, k) ?? ''} inputMode="decimal" onChange={(e) => setEdit(p, k, e.target.value)}
        aria-label={`${k} for ${p.name}`}
        style={{ width: w, padding: '4px 6px', fontSize: 12, background: edited ? '#fef9c3' : '#fff', borderColor: edited ? '#eab308' : '#e5e5e5' }} />
    )
  }
  const toggleBadge = (p: P, k: 'inStock' | 'published', on: string, off: string) => {
    const v = !!val(p, k), edited = edits[p.id] && k in edits[p.id]
    return (
      <button type="button" onClick={() => setEdit(p, k, !v)} title="Click to change"
        className={`b ${v ? 'b-g' : k === 'published' ? 'b-n' : 'b-r'}`}
        style={{ border: edited ? '1px solid #eab308' : '1px solid transparent', cursor: 'pointer' }}>{v ? on : off}</button>
    )
  }

  return (
    <div>
      <div className="ph">
        <div>
          <h1>Products</h1>
          <p>{busy ? 'Loading…' : `${list.length} products${active ? ` · ${filtered.length} match` : ''}`}</p>
        </div>
        <div className="flex gap2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-s" onClick={() => setModal('history')}><History size={13} /> History</button>
          <button className="btn btn-s" onClick={() => setModal('import')} disabled={busy}><Upload size={13} /> Import</button>
          <button className="btn btn-s" onClick={() => exportCsv(filtered, active ? '-filtered' : '')} disabled={busy || !filtered.length}
            title="Download as a CSV spreadsheet (opens in Excel / Google Sheets)">
            <Download size={13} /> Export {active ? `${filtered.length} filtered` : 'all'}
          </button>
          <button className="btn btn-p" onClick={onAdd}><Plus size={13} /> Add Product</button>
        </div>
      </div>

      {children}

      {/* Filters */}
      <div className="card" style={{ padding: 10, marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', overflow: 'visible' }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: 9, color: '#aaa' }} />
          <input value={f.q} onChange={(e) => setFilter('q', e.target.value)} placeholder="Search name, SKU, slug or tag…"
            style={{ padding: '6px 10px 6px 28px', fontSize: 12 }} />
        </div>
        <select value={f.category} onChange={(e) => setFilter('category', e.target.value)} style={sel_} aria-label="Category">
          <option value="">All categories</option>
          {allCats.map((c) => <option key={c} value={c}>{c} ({counts['c' + c] || 0})</option>)}
          <option value="__none__">No category ({counts['c__none__'] || 0})</option>
        </select>
        <select value={f.stock} onChange={(e) => setFilter('stock', e.target.value)} style={sel_} aria-label="Stock">
          <option value="">Any stock</option>
          {STOCK_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l} ({counts['s' + o.v] || 0})</option>)}
        </select>
        <select value={f.visibility} onChange={(e) => setFilter('visibility', e.target.value)} style={sel_} aria-label="Visibility">
          <option value="">Visible &amp; hidden</option>
          {VIS_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l} ({counts['v' + o.v] || 0})</option>)}
        </select>
        <select value={f.flag} onChange={(e) => setFilter('flag', e.target.value)} style={sel_} aria-label="Labels">
          <option value="">Any label</option>
          {FLAG_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l} ({counts['f' + o.v] || 0})</option>)}
        </select>
        <select value={f.issue} onChange={(e) => setFilter('issue', e.target.value)} style={sel_} aria-label="Needs attention">
          <option value="">Needs attention…</option>
          {ISSUE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l} ({counts['i' + o.v] || 0})</option>)}
        </select>
        <span className="flex gap2" style={{ alignItems: 'center', fontSize: 12, color: '#888' }}>
          ₹<input value={f.min} onChange={(e) => setFilter('min', e.target.value)} placeholder="min" inputMode="decimal" style={{ width: 62, padding: '6px', fontSize: 12 }} aria-label="Minimum price" />
          –<input value={f.max} onChange={(e) => setFilter('max', e.target.value)} placeholder="max" inputMode="decimal" style={{ width: 62, padding: '6px', fontSize: 12 }} aria-label="Maximum price" />
        </span>
        <select value={sort} onChange={(e) => setSort(e.target.value)} style={sel_} aria-label="Sort">
          {SORTS.map((o) => <option key={o.v} value={o.v}>Sort: {o.l}</option>)}
        </select>
        {active && <button className="btn btn-s btn-sm" onClick={() => { setF(EMPTY_FILTERS); setPage(1) }}><X size={11} /> Clear filters</button>}
      </div>

      {note && (
        <div className={`alert ${note.kind === 's' ? 'alert-s' : 'alert-e'}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <div>{note.text}{note.details?.length ? <ul style={{ margin: '6px 0 0 16px', fontSize: 12 }}>{note.details.map((d, i) => <li key={i}>{d}</li>)}</ul> : null}</div>
          <button onClick={() => setNote(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }} aria-label="Dismiss"><X size={13} /></button>
        </div>
      )}

      {/* Selection bar */}
      {sel.size > 0 && (
        <div className="card" style={{ padding: '8px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#f3f0ff', borderColor: '#ddd6fe', position: 'sticky', top: 56, zIndex: 5, overflow: 'visible' }}>
          <strong style={{ fontSize: 13 }}>{sel.size} selected</strong>
          {filtered.length > sel.size && (
            <button className="btn btn-s btn-sm" onClick={() => setSel(new Set(filtered.map((p) => p.id)))}>Select all {filtered.length} {active ? 'matching' : ''}</button>
          )}
          <button className="btn btn-s btn-sm" onClick={() => setSel(new Set())}>Clear selection</button>
          <span style={{ flex: 1 }} />
          <button className="btn btn-p btn-sm" onClick={() => setModal('bulk')}><Pencil size={11} /> Bulk edit</button>
          <button className="btn btn-s btn-sm" onClick={() => exportCsv(selected, '-selected')}><Download size={11} /> Export selected</button>
        </div>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        {busy && !list.length ? <div className="empty">Loading…</div>
          : filtered.length === 0 ? <div className="empty">{active ? 'No products match these filters.' : <>No products yet. <button className="btn btn-p btn-sm mt2" onClick={onAdd}>Add one</button></>}</div>
          : <table>
              <thead>
                <tr>
                  <th style={{ width: 28 }}><input type="checkbox" checked={pageAllSel} onChange={togglePage} style={{ width: 'auto' }} aria-label="Select page" /></th>
                  <th></th><th>Name</th><th>Categories</th><th>₹ Price</th><th>₹ Was</th><th>$ Price</th><th>Stock</th><th>Status</th><th>Website</th><th></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((p) => (
                  <tr key={p.id} style={{ background: sel.has(p.id) ? '#faf8ff' : undefined }}>
                    <td><input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} style={{ width: 'auto' }} aria-label={`Select ${p.name}`} /></td>
                    <td>
                      {p.images?.[0]
                        ? <img src={p.images[0]} alt="" loading="lazy" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 3 }} />
                        : <div style={{ width: 36, height: 36, background: '#f0f0f0', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb' }}><ImageIcon size={14} /></div>}
                    </td>
                    <td style={{ maxWidth: 280 }}>
                      <span className="trunc" title={p.name}>{p.name}</span>
                      <div className="muted" style={{ fontSize: 11 }}>
                        {p.sku ? `SKU ${p.sku}` : 'No SKU'}{p.ribbon ? ` · ${p.ribbon}` : ''}{p.featured ? ' · Featured' : ''}{p.bestseller ? ' · Bestseller' : ''}
                      </div>
                    </td>
                    <td>
                      {(p.collections || []).slice(0, 2).map((c: string) => <span key={c} className="tag" style={{ marginRight: 4 }}>{c}</span>)}
                      {(p.collections || []).length > 2 && <span className="muted" style={{ fontSize: 11 }}>+{p.collections.length - 2}</span>}
                    </td>
                    {NUM_FIELDS.map((k) => <td key={k}>{cellIn(p, k, k === 'stock' ? 56 : 74)}</td>)}
                    <td>{toggleBadge(p, 'inStock', 'In stock', 'Out')}</td>
                    <td>{toggleBadge(p, 'published', 'Visible', 'Hidden')}</td>
                    <td>
                      <div className="flex gap2">
                        <button className="btn btn-s btn-sm" onClick={() => onEdit(p)} aria-label={`Edit ${p.name}`}><Pencil size={11} /></button>
                        <button className="btn btn-d btn-sm" onClick={() => onDelete(p.id)} aria-label={`Delete ${p.name}`}><Trash2 size={11} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>}
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 12, color: '#666', flexWrap: 'wrap', gap: 8 }}>
          <span>Showing {(cur - 1) * pageSize + 1}–{Math.min(cur * pageSize, filtered.length)} of {filtered.length}</span>
          <div className="flex gap2" style={{ alignItems: 'center' }}>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} style={{ ...sel_, width: 'auto' }} aria-label="Products per page">
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} per page</option>)}
            </select>
            <button className="btn btn-s btn-sm" disabled={cur <= 1} onClick={() => setPage(1)}>«</button>
            <button className="btn btn-s btn-sm" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>‹ Prev</button>
            <span>Page {cur} of {pages}</span>
            <button className="btn btn-s btn-sm" disabled={cur >= pages} onClick={() => setPage(cur + 1)}>Next ›</button>
            <button className="btn btn-s btn-sm" disabled={cur >= pages} onClick={() => setPage(pages)}>»</button>
          </div>
        </div>
      )}

      {/* Unsaved quick edits */}
      {nEdits > 0 && (
        <div style={{ position: 'sticky', bottom: 12, marginTop: 12, zIndex: 6 }}>
          <div className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 16px rgba(0,0,0,.12)', borderColor: '#eab308', background: '#fffbeb', overflow: 'visible' }}>
            <strong style={{ fontSize: 13 }}>{nEdits} product{nEdits > 1 ? 's' : ''} with unsaved changes</strong>
            <span style={{ flex: 1 }} />
            <button className="btn btn-s btn-sm" onClick={() => setEdits({})} disabled={saving}>Discard</button>
            <button className="btn btn-p btn-sm" onClick={saveEdits} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
      )}

      {modal === 'bulk' && <BulkActionModal products={selected} categories={allCats} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'import' && <ImportModal products={list} categories={allCats} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'history' && <HistoryModal onClose={() => setModal(null)} onUndone={onChanged} />}
    </div>
  )
}
