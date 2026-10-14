// Bulk product tools for the admin: filtering/sorting, bulk actions,
// spreadsheet (CSV) export/import and sending changes to the backend.
import { authedFetch } from '@/lib/auth'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
export type P = any

// ── Filtering & sorting ──────────────────────────────────────────────────────
export interface Filters {
  q: string; category: string; stock: string; visibility: string
  flag: string; issue: string; min: string; max: string
}
export const EMPTY_FILTERS: Filters = { q: '', category: '', stock: '', visibility: '', flag: '', issue: '', min: '', max: '' }
export const LOW_STOCK = 5

export const STOCK_OPTS = [
  { v: 'in', l: 'In stock' }, { v: 'out', l: 'Out of stock' },
  { v: 'low', l: `Low stock (1–${LOW_STOCK})` }, { v: 'mismatch', l: 'Stock 0 but marked "in stock"' },
]
export const VIS_OPTS = [{ v: 'published', l: 'Visible on site' }, { v: 'hidden', l: 'Hidden' }]
export const FLAG_OPTS = [
  { v: 'sale', l: 'On sale (has "was" price)' }, { v: 'featured', l: 'Featured' },
  { v: 'bestseller', l: 'Bestseller' }, { v: 'ribbon', l: 'Has a ribbon' },
]
export const ISSUE_OPTS = [
  { v: 'noimage', l: 'No image' }, { v: 'nousd', l: 'No USD price' }, { v: 'zeroprice', l: 'No ₹ price' },
  { v: 'nocat', l: 'No category' }, { v: 'nosku', l: 'No SKU' }, { v: 'nodesc', l: 'No description' },
]
export const SORTS = [
  { v: 'updated', l: 'Recently updated' }, { v: 'newest', l: 'Newest first' },
  { v: 'name', l: 'Name A–Z' }, { v: 'price_asc', l: 'Price: low to high' },
  { v: 'price_desc', l: 'Price: high to low' }, { v: 'stock_asc', l: 'Stock: lowest first' },
  { v: 'stock_desc', l: 'Stock: highest first' },
]

export const num = (v: any) => (typeof v === 'number' ? v : parseFloat(v)) || 0
export const isPublished = (p: P) => p.published !== false

export function matchStock(p: P, v: string) {
  const s = num(p.stock)
  if (v === 'in') return !!p.inStock
  if (v === 'out') return !p.inStock
  if (v === 'low') return s > 0 && s <= LOW_STOCK
  if (v === 'mismatch') return !!p.inStock && s <= 0
  return true
}
export function matchFlag(p: P, v: string) {
  if (v === 'sale') return num(p.originalPriceINR) > num(p.priceINR)
  if (v === 'featured') return !!p.featured
  if (v === 'bestseller') return !!p.bestseller
  if (v === 'ribbon') return !!(p.ribbon || '').trim()
  return true
}
export function matchIssue(p: P, v: string) {
  if (v === 'noimage') return !(p.images || []).length
  if (v === 'nousd') return num(p.priceUSD) <= 0
  if (v === 'zeroprice') return num(p.priceINR) <= 0
  if (v === 'nocat') return !(p.collections || []).length
  if (v === 'nosku') return !(p.sku || '').trim()
  if (v === 'nodesc') return !(p.description || '').trim()
  return true
}

export function applyFilters(list: P[], f: Filters): P[] {
  const words = f.q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const min = f.min === '' ? null : num(f.min)
  const max = f.max === '' ? null : num(f.max)
  return list.filter((p) => {
    if (words.length) {
      const hay = [p.name, p.slug, p.sku, ...(p.tags || [])].join(' ').toLowerCase()
      if (!words.every((w) => hay.includes(w))) return false
    }
    if (f.category === '__none__') { if ((p.collections || []).length) return false }
    else if (f.category && !(p.collections || []).includes(f.category)) return false
    if (f.stock && !matchStock(p, f.stock)) return false
    if (f.visibility === 'published' && !isPublished(p)) return false
    if (f.visibility === 'hidden' && isPublished(p)) return false
    if (f.flag && !matchFlag(p, f.flag)) return false
    if (f.issue && !matchIssue(p, f.issue)) return false
    if (min !== null && num(p.priceINR) < min) return false
    if (max !== null && num(p.priceINR) > max) return false
    return true
  })
}

export function sortList(list: P[], key: string): P[] {
  const a = [...list]
  const str = (x: any) => String(x || '')
  switch (key) {
    case 'newest':     return a.sort((x, y) => str(y.createdAt).localeCompare(str(x.createdAt)))
    case 'name':       return a.sort((x, y) => str(x.name).localeCompare(str(y.name)))
    case 'price_asc':  return a.sort((x, y) => num(x.priceINR) - num(y.priceINR))
    case 'price_desc': return a.sort((x, y) => num(y.priceINR) - num(x.priceINR))
    case 'stock_asc':  return a.sort((x, y) => num(x.stock) - num(y.stock))
    case 'stock_desc': return a.sort((x, y) => num(y.stock) - num(x.stock))
    default:           return a.sort((x, y) => str(y.updatedAt || y.createdAt).localeCompare(str(x.updatedAt || x.createdAt)))
  }
}

// ── Bulk actions ─────────────────────────────────────────────────────────────
export type Rounding = 'none' | 'whole' | '9' | '99' | '.99'
export type BulkOp =
  | { kind: 'price'; currency: 'INR' | 'USD'; mode: 'set' | 'pct_up' | 'pct_down' | 'amt_up' | 'amt_down'; value: number; rounding: Rounding; keepWas: boolean }
  | { kind: 'clearSale' }
  | { kind: 'stock'; mode: 'set' | 'add'; value: number }
  | { kind: 'inStock' | 'published' | 'featured' | 'bestseller'; value: boolean }
  | { kind: 'catAdd' | 'catRemove' | 'tagAdd' | 'tagRemove' | 'ribbon'; value: string }
  | { kind: 'delete' }

export function roundPrice(x: number, r: Rounding): number {
  if (!(x > 0)) return 0
  let v = x
  if (r === 'whole') v = Math.round(x)
  else if (r === '9') v = Math.max(9, Math.round((x + 1) / 10) * 10 - 1)
  else if (r === '99') v = Math.max(99, Math.round((x + 1) / 100) * 100 - 1)
  else if (r === '.99') v = Math.max(0.99, Math.round(x + 0.01) - 0.01)
  return Math.round(v * 100) / 100
}

/** Fields this action would change on one product, or null if nothing changes. */
export function computeOp(p: P, op: BulkOp): Record<string, any> | null {
  const out: Record<string, any> = {}
  switch (op.kind) {
    case 'price': {
      const pf = op.currency === 'INR' ? 'priceINR' : 'priceUSD'
      const wf = op.currency === 'INR' ? 'originalPriceINR' : 'originalPriceUSD'
      const cur = num(p[pf])
      let next = cur
      if (op.mode === 'set') next = op.value
      if (op.mode === 'pct_up') next = cur * (1 + op.value / 100)
      if (op.mode === 'pct_down') next = cur * (1 - op.value / 100)
      if (op.mode === 'amt_up') next = cur + op.value
      if (op.mode === 'amt_down') next = cur - op.value
      next = op.rounding === 'none' ? Math.max(0, Math.round(next * 100) / 100) : roundPrice(Math.max(0, next), op.rounding)
      if (next !== cur) out[pf] = next
      if (op.keepWas && next < cur && num(p[wf]) < cur) out[wf] = cur
      break
    }
    case 'clearSale':
      if (num(p.originalPriceINR)) out.originalPriceINR = 0
      if (num(p.originalPriceUSD)) out.originalPriceUSD = 0
      break
    case 'stock': {
      const next = Math.max(0, Math.round(op.mode === 'set' ? op.value : num(p.stock) + op.value))
      if (next !== num(p.stock)) out.stock = next
      break
    }
    case 'inStock': case 'featured': case 'bestseller':
      if (!!p[op.kind] !== op.value) out[op.kind] = op.value
      break
    case 'published':
      if (isPublished(p) !== op.value) out.published = op.value
      break
    case 'catAdd': case 'catRemove': case 'tagAdd': case 'tagRemove': {
      const f = op.kind.startsWith('cat') ? 'collections' : 'tags'
      const cur: string[] = p[f] || []
      const has = cur.some((x) => x.toLowerCase() === op.value.toLowerCase())
      if (op.kind.endsWith('Add') && !has) out[f] = [...cur, op.value]
      if (op.kind.endsWith('Remove') && has) out[f] = cur.filter((x) => x.toLowerCase() !== op.value.toLowerCase())
      break
    }
    case 'ribbon':
      if ((p.ribbon || '') !== op.value) out.ribbon = op.value
      break
    case 'delete':
      out.deleted = true
      break
  }
  return Object.keys(out).length ? out : null
}

const money = (c: string, v: number) => (c === 'INR' ? `₹${v}` : `$${v}`)
export function describeOp(op: BulkOp): string {
  switch (op.kind) {
    case 'price': {
      const c = op.currency
      const m = { set: `set to ${money(c, op.value)}`, pct_up: `+${op.value}%`, pct_down: `−${op.value}%`,
                  amt_up: `+${money(c, op.value)}`, amt_down: `−${money(c, op.value)}` }[op.mode]
      return `${c} price ${m}${op.keepWas ? ' (old price kept as "was")' : ''}`
    }
    case 'clearSale': return 'Removed "was" prices'
    case 'stock': return op.mode === 'set' ? `Stock set to ${op.value}` : `Stock ${op.value >= 0 ? '+' : ''}${op.value}`
    case 'inStock': return op.value ? 'Marked in stock' : 'Marked out of stock'
    case 'published': return op.value ? 'Made visible' : 'Hidden from site'
    case 'featured': return op.value ? 'Featured on' : 'Featured off'
    case 'bestseller': return op.value ? 'Bestseller on' : 'Bestseller off'
    case 'catAdd': return `Added to "${op.value}"`
    case 'catRemove': return `Removed from "${op.value}"`
    case 'tagAdd': return `Tag "${op.value}" added`
    case 'tagRemove': return `Tag "${op.value}" removed`
    case 'ribbon': return op.value ? `Ribbon "${op.value}"` : 'Ribbon removed'
    case 'delete': return 'Deleted'
  }
}

// ── Sending changes (chunked; one undoable batch) ────────────────────────────
export interface SendResult { batchId: string | null; updated: number; created: number; skipped: number; errors: any[] }

export async function sendChanges(
  opts: { label: string; source: 'bulk' | 'inline' | 'import'; updates?: { id: string; set: Record<string, any> }[]; creates?: any[] },
  onProgress?: (done: number, total: number) => void,
): Promise<SendResult> {
  const CHUNK = 100
  const jobs: { updates: any[]; creates: any[] }[] = []
  const ups = opts.updates || [], crs = opts.creates || []
  for (let i = 0; i < ups.length; i += CHUNK) jobs.push({ updates: ups.slice(i, i + CHUNK), creates: [] })
  for (let i = 0; i < crs.length; i += CHUNK) jobs.push({ updates: [], creates: crs.slice(i, i + CHUNK) })
  const total = ups.length + crs.length
  const res: SendResult = { batchId: null, updated: 0, created: 0, skipped: 0, errors: [] }
  let done = 0
  onProgress?.(0, total)
  for (const j of jobs) {
    const r = await authedFetch(`${API}/admin/products/bulk`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: opts.label, source: opts.source, batchId: res.batchId, ...j }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      const msg = typeof d.detail === 'string' ? d.detail : `Save failed (${r.status})`
      throw new Error(done ? `${msg}. ${done} of ${total} products were already saved – undo them from History if needed.` : msg)
    }
    res.batchId = d.batchId || res.batchId
    res.updated += d.updated || 0; res.created += d.created || 0; res.skipped += d.skipped || 0
    res.errors.push(...(d.errors || []))
    done += j.updates.length + j.creates.length
    onProgress?.(done, total)
  }
  return res
}

export async function fetchBatches(): Promise<any[]> {
  const r = await authedFetch(`${API}/admin/products/batches`)
  if (!r.ok) throw new Error('Could not load history')
  return r.json()
}
export async function undoBatch(id: string): Promise<{ reverted: number; errors: any[] }> {
  const r = await authedFetch(`${API}/admin/products/batches/${encodeURIComponent(id)}/undo`, { method: 'POST' })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(typeof d.detail === 'string' ? d.detail : 'Undo failed')
  return d
}

// ── Spreadsheet (CSV) export / import ────────────────────────────────────────
type FType = 'id' | 'text' | 'num' | 'int' | 'bool' | 'cats' | 'list' | 'urls' | 'readonly'
export const CSV_FIELDS: { key: string; header: string; type: FType }[] = [
  { key: 'id', header: 'ID', type: 'id' },
  { key: 'name', header: 'Name', type: 'text' },
  { key: 'slug', header: 'URL slug (read-only)', type: 'readonly' },
  { key: 'sku', header: 'SKU', type: 'text' },
  { key: 'collections', header: 'Categories', type: 'cats' },
  { key: 'tags', header: 'Tags', type: 'list' },
  { key: 'priceINR', header: 'Price INR', type: 'num' },
  { key: 'originalPriceINR', header: 'Was Price INR', type: 'num' },
  { key: 'priceUSD', header: 'Price USD', type: 'num' },
  { key: 'originalPriceUSD', header: 'Was Price USD', type: 'num' },
  { key: 'stock', header: 'Stock', type: 'int' },
  { key: 'inStock', header: 'In Stock', type: 'bool' },
  { key: 'published', header: 'Visible', type: 'bool' },
  { key: 'featured', header: 'Featured', type: 'bool' },
  { key: 'bestseller', header: 'Bestseller', type: 'bool' },
  { key: 'ribbon', header: 'Ribbon', type: 'text' },
  { key: 'weight', header: 'Weight', type: 'num' },
  { key: 'cost', header: 'Cost', type: 'num' },
  { key: 'brand', header: 'Brand', type: 'text' },
  { key: 'images', header: 'Image URLs', type: 'urls' },
  { key: 'description', header: 'Description', type: 'text' },
]
export const FIELD_LABEL: Record<string, string> = Object.fromEntries(CSV_FIELDS.map((f) => [f.key, f.header]))
FIELD_LABEL.deleted = 'Deleted'
const SEP = ' | '

function cellOut(p: P, f: { key: string; type: FType }): string {
  const v = f.key === 'published' ? isPublished(p) : p[f.key]
  if (f.type === 'bool') return v ? 'yes' : 'no'
  if (f.type === 'cats' || f.type === 'list' || f.type === 'urls') return (v || []).join(SEP)
  if (f.type === 'num' || f.type === 'int') return String(num(v))
  return v == null ? '' : String(v)
}
const esc = (s: string) => (/[",;\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

export function toCsv(list: P[]): string {
  const lines = [CSV_FIELDS.map((f) => esc(f.header)).join(',')]
  for (const p of list) lines.push(CSV_FIELDS.map((f) => esc(cellOut(p, f))).join(','))
  return '﻿' + lines.join('\r\n') + '\r\n'      // BOM so Excel reads ₹ / Hindi correctly
}

export function downloadCsv(list: P[], name: string) {
  const blob = new Blob([toCsv(list)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** RFC 4180 parser; auto-detects comma / semicolon / tab (Excel in some locales uses ';'). */
export function parseCsv(text: string): string[][] {
  text = text.replace(/^﻿/, '')
  const nl = text.search(/\r?\n/)
  const firstLine = nl < 0 ? text : text.slice(0, nl)
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 }
  let inQ = false
  for (const ch of firstLine) { if (ch === '"') inQ = !inQ; else if (!inQ && ch in counts) counts[ch]++ }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  const d = best[1] > 0 ? best[0] : ','
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false }
      else cell += ch
    } else if (ch === '"' && cell === '') q = true
    else if (ch === d) { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

export interface Change { field: string; from: any; to: any }
export interface ImportPlan {
  updates: { id: string; name: string; row: number; set: Record<string, any>; changes: Change[] }[]
  creates: { row: number; data: Record<string, any> }[]
  errors: { row: number; msg: string }[]
  unchanged: number
  fieldCounts: Record<string, number>
  ignoredColumns: string[]
}

const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '')
const HEADER_MAP: Record<string, string> = {}
for (const f of CSV_FIELDS) { HEADER_MAP[norm(f.header)] = f.key; HEADER_MAP[norm(f.key)] = f.key }
Object.assign(HEADER_MAP, { category: 'collections', collections: 'collections', image: 'images', images: 'images',
  visible: 'published', published: 'published', instock: 'inStock', wasprice: 'originalPriceINR',
  price: 'priceINR', mrp: 'originalPriceINR' })

const TRUE = new Set(['yes', 'y', 'true', '1', 'on'])
const FALSE = new Set(['no', 'n', 'false', '0', 'off'])
const splitList = (s: string) => s.split('|').map((x) => x.trim()).filter(Boolean)
function same(a: any, b: any): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a || []) === JSON.stringify(b || [])
  if (typeof b === 'number') return Math.abs(num(a) - b) < 1e-9
  if (typeof b === 'boolean') return !!a === b
  return String(a ?? '') === String(b ?? '')
}

/** Parse one cell. {skip:true} = leave unchanged; throws a message for bad values. */
function parseCell(raw: string, type: FType, categories: Map<string, string>): { value?: any; skip?: boolean } {
  const s = raw.trim()
  if (s.includes('�')) throw 'garbled characters – save the file as "CSV UTF-8"'
  switch (type) {
    case 'num': case 'int': {
      if (s === '') return { skip: true }                       // empty number = leave as is (type 0 to clear)
      const v = Number(s.replace(/^Rs\.?/i, '').replace(/[₹$,\s]/g, ''))
      if (!isFinite(v) || v < 0) throw `"${s}" is not a valid number`
      if (type === 'int' && !Number.isInteger(v)) throw `"${s}" must be a whole number`
      return { value: v }
    }
    case 'bool':
      if (s === '') return { skip: true }
      if (TRUE.has(s.toLowerCase())) return { value: true }
      if (FALSE.has(s.toLowerCase())) return { value: false }
      throw `"${s}" should be yes or no`
    case 'cats': {
      if (s === '') return { skip: true }                       // categories are required: blank = leave as is
      const out: string[] = []
      for (const c of splitList(s)) {
        const canon = categories.get(c.toLowerCase())
        if (!canon) throw `unknown category "${c}" (separate several with | )`
        if (!out.includes(canon)) out.push(canon)
      }
      if (!out.length) throw 'at least one category is required'
      return { value: out }
    }
    case 'list': return { value: splitList(s) }
    case 'urls': {
      const urls = s.split(/[|\s]+/).map((x) => x.trim()).filter(Boolean)
      const bad = urls.find((u) => !/^https?:\/\//i.test(u))
      if (bad) throw `"${bad.slice(0, 40)}" is not an image URL`
      return { value: urls }
    }
    default: return { value: s }
  }
}

export function analyzeImport(text: string, products: P[], allCategories: string[]): ImportPlan {
  const plan: ImportPlan = { updates: [], creates: [], errors: [], unchanged: 0, fieldCounts: {}, ignoredColumns: [] }
  const rows = parseCsv(text)
  if (rows.length < 2) { plan.errors.push({ row: 1, msg: 'The file has no product rows' }); return plan }
  const cols = rows[0].map((h) => HEADER_MAP[norm(h)] || null)
  rows[0].forEach((h, i) => { if (!cols[i] && h.trim()) plan.ignoredColumns.push(h.trim()) })
  const idCol = cols.indexOf('id')
  if (idCol < 0) { plan.errors.push({ row: 1, msg: 'No "ID" column – export first, edit that file, then import it' }); return plan }
  const byId = new Map(products.map((p) => [p.id, p]))
  const cats = new Map(allCategories.map((c) => [c.toLowerCase(), c]))
  const fieldType: Record<string, FType> = Object.fromEntries(CSV_FIELDS.map((f) => [f.key, f.type]))
  const seen = new Set<string>()

  rows.slice(1).forEach((r, idx) => {
    const rowNo = idx + 2
    const id = (r[idCol] || '').trim()
    const vals: Record<string, any> = {}
    const errs: string[] = []
    cols.forEach((key, i) => {
      if (!key || key === 'id' || fieldType[key] === 'readonly') return
      try {
        const res = parseCell(r[i] ?? '', fieldType[key], cats)
        if (!res.skip) vals[key] = res.value
      } catch (m) { errs.push(`${FIELD_LABEL[key]}: ${m}`) }
    })
    if (errs.length) { plan.errors.push({ row: rowNo, msg: errs.join('; ') }); return }

    if (!id) {                                                 // blank ID = new product
      if (!(vals.name || '').trim()) { plan.errors.push({ row: rowNo, msg: 'New product needs a Name' }); return }
      if (!(vals.collections || []).length) { plan.errors.push({ row: rowNo, msg: 'New product needs a Category' }); return }
      const data: Record<string, any> = { _row: rowNo }
      for (const [k, v] of Object.entries(vals)) if (v !== '' && !(Array.isArray(v) && !v.length)) data[k] = v  // blanks → defaults
      plan.creates.push({ row: rowNo, data })
      return
    }
    if (seen.has(id)) { plan.errors.push({ row: rowNo, msg: 'This ID appears twice in the file' }); return }
    seen.add(id)
    const p = byId.get(id)
    if (!p) { plan.errors.push({ row: rowNo, msg: 'ID not found (deleted product, or the ID was edited)' }); return }
    if ('name' in vals && !String(vals.name).trim()) { plan.errors.push({ row: rowNo, msg: 'Name cannot be empty' }); return }
    const set: Record<string, any> = {}
    const changes: Change[] = []
    for (const [k, v] of Object.entries(vals)) {
      const cur = k === 'published' ? isPublished(p) : p[k]
      if (!same(cur, v)) {
        set[k] = v; changes.push({ field: k, from: cur, to: v })
        plan.fieldCounts[k] = (plan.fieldCounts[k] || 0) + 1
      }
    }
    if (changes.length) plan.updates.push({ id, name: p.name, row: rowNo, set, changes })
    else plan.unchanged++
  })
  return plan
}

export function fmtVal(field: string, v: any): string {
  if (v === undefined || v === null || v === '') return '—'
  if (Array.isArray(v)) return v.length ? (field === 'images' ? `${v.length} image${v.length > 1 ? 's' : ''}` : v.join(', ')) : '—'
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  if (field === 'description') return String(v).length > 40 ? String(v).slice(0, 40) + '…' : String(v)
  if (/INR$/.test(field)) return `₹${num(v).toLocaleString('en-IN')}`
  if (/USD$/.test(field)) return `$${num(v)}`
  return String(v)
}
