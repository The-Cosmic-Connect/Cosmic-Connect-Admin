// lib/fetchProducts.ts (admin)
//
// Same shape as the frontend's helper: memory + localStorage cache, plus a
// synchronous getter so the Products page hydrates state at mount with zero
// loading flash. After any product write the caller should call
// invalidateProductsCache() so the next read is fresh.

const API     = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const TTL_MS  = 30 * 60 * 1000
const STORAGE = 'cc-admin-products-cache-v2'

interface Cached { ts: number; data: any[] }

let memCache: Cached | null = null
let inflight: Promise<any[]> | null = null

function readStorage(): Cached | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE)
    if (!raw) return null
    const parsed: Cached = JSON.parse(raw)
    if (!parsed?.ts || !Array.isArray(parsed.data)) return null
    if (Date.now() - parsed.ts > TTL_MS) return null
    return parsed
  } catch { return null }
}

function writeStorage(c: Cached): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(STORAGE, JSON.stringify(c)) } catch {}
}

async function fetchFromApi(): Promise<any[]> {
  let all: any[] = []
  let lastKey: any = null
  do {
    const qs = new URLSearchParams({ published_only: 'false', limit: '500' })
    if (lastKey) qs.set('last_key', JSON.stringify(lastKey))
    const r = await fetch(`${API}/products?${qs.toString()}`)
    if (!r.ok) break
    const d = await r.json()
    all = all.concat(d.products || [])
    lastKey = d.nextKey || null
  } while (lastKey)
  return all
}

/**
 * Synchronous cache check. Returns cached products immediately if fresh,
 * otherwise null. Use in `useState(() => …)` initializers so the page
 * renders with data on first paint — no loading flash on tab switch.
 */
export function getCachedProducts(): any[] | null {
  if (memCache && Date.now() - memCache.ts < TTL_MS) return memCache.data
  const fromStorage = readStorage()
  if (fromStorage) { memCache = fromStorage; return fromStorage.data }
  return null
}

export async function fetchAllProducts(opts: { force?: boolean } = {}): Promise<any[]> {
  if (!opts.force) {
    const cached = getCachedProducts()
    if (cached) return cached
  }
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const data = await fetchFromApi()
      const fresh: Cached = { ts: Date.now(), data }
      memCache = fresh
      writeStorage(fresh)
      return data
    } finally { inflight = null }
  })()
  return inflight
}

export function invalidateProductsCache(): void {
  memCache = null
  inflight = null
  if (typeof window !== 'undefined') {
    try { window.localStorage.removeItem(STORAGE) } catch {}
  }
}
