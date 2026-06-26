// lib/fetchProducts.ts (admin)
//
// Same stale-while-revalidate + incremental-sync model as the frontend.
// Notable difference: the admin's local writes invalidate the cache directly,
// so it doesn't usually wait for the background sync — it goes through a
// `force: true` refetch after each save / delete.

const API        = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const FRESH_MS   = 5  * 60 * 1000
const STALE_MS   = 24 * 60 * 60 * 1000
const STORAGE    = 'cc-admin-products-cache-v4'

interface Cached { ts: number; syncedAt: string; data: any[] }

let memCache: Cached | null = null
let inflight: Promise<any[]> | null = null

function readStorage(): Cached | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE)
    if (!raw) return null
    const parsed: Cached = JSON.parse(raw)
    if (!parsed?.ts || !parsed.syncedAt || !Array.isArray(parsed.data)) return null
    return parsed
  } catch { return null }
}

function writeStorage(c: Cached): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(STORAGE, JSON.stringify(c)) } catch {}
}

function ageOfCache(): number {
  if (memCache) return Date.now() - memCache.ts
  const fromStorage = readStorage()
  if (fromStorage) { memCache = fromStorage; return Date.now() - fromStorage.ts }
  return Infinity
}

async function doFullFetch(): Promise<Cached> {
  let all: any[]      = []
  let lastKey: any    = null
  let serverTime      = new Date().toISOString()

  do {
    const qs = new URLSearchParams({ published_only: 'false', limit: '500' })
    if (lastKey) qs.set('last_key', JSON.stringify(lastKey))
    const r = await fetch(`${API}/products?${qs}`)
    if (!r.ok) break
    const d = await r.json()
    all     = all.concat(d.products || [])
    lastKey = d.nextKey || null
    if (d.serverTime) serverTime = d.serverTime
  } while (lastKey)

  const fresh: Cached = { ts: Date.now(), syncedAt: serverTime, data: all }
  memCache = fresh
  writeStorage(fresh)
  return fresh
}

async function doDeltaSync(prev: Cached): Promise<Cached> {
  const changes: any[] = []
  let lastKey: any     = null
  let serverTime       = prev.syncedAt
  let fullSync         = false

  do {
    const params = new URLSearchParams({ since: prev.syncedAt, limit: '1000' })
    if (lastKey) params.set('last_key', JSON.stringify(lastKey))
    const r = await fetch(`${API}/products/changes-since?${params}`)
    if (!r.ok) { fullSync = true; break }
    const d = await r.json()
    if (d.fullSync) { fullSync = true; break }
    if (Array.isArray(d.items)) changes.push(...d.items)
    lastKey    = d.nextKey   || null
    serverTime = d.serverTime || serverTime
  } while (lastKey)

  if (fullSync) return doFullFetch()

  // Admin view INCLUDES soft-deleted items (so admin can see what was removed).
  // We still drop deleted ids from cache here — if you want the admin to see
  // tombstones, change this to upsert all items including deleted=true ones.
  const byId = new Map(prev.data.map((p) => [p.id, p]))
  for (const item of changes) {
    if (item?.deleted === true) {
      if (item.id) byId.delete(item.id)
    } else if (item?.id) {
      byId.set(item.id, item)
    }
  }
  const merged = Array.from(byId.values())
  const fresh: Cached = { ts: Date.now(), syncedAt: serverTime, data: merged }
  memCache = fresh
  writeStorage(fresh)
  return fresh
}

function refreshInBackground(): void {
  if (inflight || !memCache) return
  inflight = doDeltaSync(memCache).then((c) => c.data).finally(() => { inflight = null })
}

export function getCachedProducts(): any[] | null {
  const age = ageOfCache()
  if (age < STALE_MS && memCache) return memCache.data
  return null
}

export async function fetchAllProducts(opts: { force?: boolean } = {}): Promise<any[]> {
  if (opts.force) {
    if (inflight) return inflight
    inflight = doFullFetch().then((c) => c.data).finally(() => { inflight = null })
    return inflight
  }
  const age = ageOfCache()
  if (age < FRESH_MS && memCache) return memCache.data
  if (age < STALE_MS && memCache) { refreshInBackground(); return memCache.data }
  if (inflight) return inflight
  inflight = doFullFetch().then((c) => c.data).finally(() => { inflight = null })
  return inflight
}

export function invalidateProductsCache(): void {
  memCache = null
  inflight = null
  if (typeof window !== 'undefined') {
    try { window.localStorage.removeItem(STORAGE) } catch {}
  }
}

/**
 * Upsert a single product into the local cache (in-memory + localStorage),
 * preserving its existing position when updating. Used after admin save() so
 * the UI updates instantly with zero network calls — no full-catalog refetch.
 *
 * For new products (id not yet in cache) the row is prepended so the admin
 * sees their freshly-created product at the top.
 *
 * Returns the new full list (sync), so the caller can pass it straight to
 * setState without going through fetchAllProducts().
 */
export function upsertProductInCache(product: any): any[] {
  if (!product?.id) return memCache?.data || []
  // Make sure memCache is hydrated (so localStorage state, if any, isn't lost).
  const base = memCache?.data || readStorage()?.data || []
  const idx = base.findIndex((p) => p?.id === product.id)
  let next: any[]
  if (idx >= 0) {
    next = base.slice()
    next[idx] = { ...base[idx], ...product }    // merge so we keep unsent fields
  } else {
    next = [product, ...base]                    // prepend new products
  }
  const fresh: Cached = {
    ts:       Date.now(),
    // Keep the existing syncedAt watermark; this local edit doesn't change it.
    syncedAt: memCache?.syncedAt || new Date().toISOString(),
    data:     next,
  }
  memCache = fresh
  writeStorage(fresh)
  return next
}

/**
 * Drop a product from the local cache by id. Use after admin del() to update
 * the UI instantly without refetching the catalog.
 */
export function removeProductFromCache(id: string): any[] {
  const base = memCache?.data || readStorage()?.data || []
  const next = base.filter((p) => p?.id !== id)
  const fresh: Cached = {
    ts:       Date.now(),
    syncedAt: memCache?.syncedAt || new Date().toISOString(),
    data:     next,
  }
  memCache = fresh
  writeStorage(fresh)
  return next
}
