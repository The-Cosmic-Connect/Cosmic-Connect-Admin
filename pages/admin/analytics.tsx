// Website analytics (read from Google Analytics 4 via the backend).
import { useCallback, useEffect, useState } from 'react'
import Shell from '@/components/Shell'
import { RefreshCw, ExternalLink } from 'lucide-react'
import { authedFetch } from '@/lib/auth'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const GA_URL = 'https://analytics.google.com/analytics/web/'

type RangeKey = 'today' | '7d' | '28d' | '90d'
const RANGES: { key: RangeKey; label: string; prev: string }[] = [
  { key: 'today', label: 'Today',        prev: 'yesterday' },
  { key: '7d',    label: 'Last 7 days',  prev: 'previous 7 days' },
  { key: '28d',   label: 'Last 28 days', prev: 'previous 28 days' },
  { key: '90d',   label: 'Last 90 days', prev: 'previous 90 days' },
]

interface Totals { activeUsers: number; newUsers: number; sessions: number; screenPageViews: number; userEngagementDuration: number }
interface Overview {
  configured: boolean
  totals: Totals; previous: Totals
  trend: { t: string; users: number; sessions: number }[]; trendUnit: 'hour' | 'day'
  countries: { country: string; code: string; users: number; sessions: number }[]
  pages: { path: string; views: number; users: number }[]
  channels: { channel: string; sessions: number; users: number }[]
  devices: { device: string; users: number }[]
  cities: { city: string; code: string; users: number }[]
  sources: { source: string; sessions: number }[]
  generatedAt: number
}
interface Realtime { configured: boolean; activeUsers: number; countries: { country: string; code: string; users: number }[] }

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN')
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function label(t: string, unit: 'hour' | 'day') {
  if (unit === 'hour') return `${t.slice(8, 10)}:00`
  return `${Number(t.slice(6, 8))} ${MONTHS[Number(t.slice(4, 6)) - 1]}`
}
function flag(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return '🌐'
  return String.fromCodePoint(...code.split('').map(c => 0x1f1a5 + c.charCodeAt(0)))
}
function duration(sec: number) {
  if (!sec || !isFinite(sec)) return '0s'
  const m = Math.floor(sec / 60), s = Math.round(sec % 60)
  return m ? `${m}m ${s}s` : `${s}s`
}
function change(cur: number, prev: number) {
  if (!prev) return null
  return Math.round(((cur - prev) / prev) * 100)
}

function Stat({ label: l, value, cur, prev, prevLabel }: { label: string; value: string; cur: number; prev: number; prevLabel: string }) {
  const c = change(cur, prev)
  return (
    <div className="stat">
      <div className="stat-n">{value}</div>
      <div className="stat-l">{l}</div>
      {c !== null && (
        <div style={{ fontSize: 11, marginTop: 6, color: c > 0 ? '#16a34a' : c < 0 ? '#dc2626' : '#888' }}
             title={`vs ${prevLabel}`}>
          {c > 0 ? '▲' : c < 0 ? '▼' : '•'} {Math.abs(c)}% <span style={{ color: '#aaa' }}>vs {prevLabel}</span>
        </div>
      )}
    </div>
  )
}

function TrendChart({ data, unit }: { data: Overview['trend']; unit: 'hour' | 'day' }) {
  if (!data.length) return <p className="muted" style={{ padding: 16 }}>No visits in this period yet.</p>
  const W = 800, H = 180, P = 28
  const max = Math.max(...data.map(d => d.users), 1)
  const x = (i: number) => P + (data.length === 1 ? (W - 2 * P) / 2 : (i * (W - 2 * P)) / (data.length - 1))
  const y = (v: number) => H - P - (v / max) * (H - 2 * P)
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.users)}`).join(' ')
  const area = `${line} L${x(data.length - 1)},${H - P} L${x(0)},${H - P} Z`
  const every = Math.max(1, Math.ceil(data.length / 8))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Visitors over time">
      {[0, 0.5, 1].map(f => (
        <g key={f}>
          <line x1={P} x2={W - P} y1={y(max * f)} y2={y(max * f)} stroke="#f0f0f0" />
          <text x={P - 6} y={y(max * f) + 4} fontSize="10" fill="#aaa" textAnchor="end">{Math.round(max * f)}</text>
        </g>
      ))}
      <path d={area} fill="#5b21b6" opacity="0.08" />
      <path d={line} fill="none" stroke="#5b21b6" strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={d.t}>
          <circle cx={x(i)} cy={y(d.users)} r={data.length > 40 ? 2 : 3} fill="#5b21b6">
            <title>{`${label(d.t, unit)}: ${d.users} visitors, ${d.sessions} visits`}</title>
          </circle>
          {i % every === 0 && (
            <text x={x(i)} y={H - 8} fontSize="10" fill="#aaa" textAnchor="middle">{label(d.t, unit)}</text>
          )}
        </g>
      ))}
    </svg>
  )
}

function BarList<T>({ title, rows, name, value, valueLabel, empty = 'No data yet' }:
  { title: string; rows: T[]; name: (r: T) => React.ReactNode; value: (r: T) => number; valueLabel: string; empty?: string }) {
  const total = rows.reduce((s, r) => s + value(r), 0) || 1
  const max = Math.max(...rows.map(value), 1)
  return (
    <div className="card">
      <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h2>{title}</h2><span className="muted">{valueLabel}</span>
      </div>
      <div style={{ padding: '6px 0' }}>
        {rows.length === 0 ? <p className="muted" style={{ padding: '10px 16px' }}>{empty}</p> : rows.map((r, i) => (
          <div key={i} style={{ position: 'relative', padding: '7px 16px', fontSize: 13 }}>
            <div style={{ position: 'absolute', left: 8, top: 3, bottom: 3, borderRadius: 3, background: '#f3f0ff',
                          width: `calc(${(value(r) / max) * 100}% - 16px)` }} />
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name(r)}</span>
              <span style={{ whiteSpace: 'nowrap', color: '#333' }}>
                {fmt(value(r))} <span className="muted">{Math.round((value(r) / total) * 100)}%</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<RangeKey>('7d')
  const [data, setData]   = useState<Overview | null>(null)
  const [rt, setRt]       = useState<Realtime | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (r: RangeKey) => {
    setLoading(true); setError('')
    try {
      const res = await authedFetch(`${API}/admin/analytics?range=${r}`)
      const d = await res.json()
      if (!res.ok) throw new Error(d.detail || 'Could not load analytics')
      setData(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load analytics')
    } finally { setLoading(false) }
  }, [])

  const loadRt = useCallback(async () => {
    try {
      const res = await authedFetch(`${API}/admin/analytics/realtime`)
      if (res.ok) setRt(await res.json())
    } catch { /* realtime is best-effort */ }
  }, [])

  useEffect(() => { load(range) }, [range, load])
  useEffect(() => {
    loadRt()
    const id = setInterval(() => { if (!document.hidden) loadRt() }, 60_000)
    return () => clearInterval(id)
  }, [loadRt])

  const meta = RANGES.find(r => r.key === range)!
  const t = data?.totals, p = data?.previous

  return (
    <Shell title="Analytics">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Website Analytics</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {rt?.configured && (
            <span className="b b-g" title={rt.countries.map(c => `${c.country}: ${c.users}`).join('\n') || 'Nobody right now'}>
              ● {rt.activeUsers} on the site now
            </span>
          )}
          <button className="btn btn-s btn-sm" onClick={() => { load(range); loadRt() }} disabled={loading}>
            <RefreshCw size={13} /> Refresh
          </button>
          <a className="btn btn-s btn-sm" href={GA_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={13} /> Google Analytics
          </a>
        </div>
      </div>

      <div className="tabs">
        {RANGES.map(r => (
          <button key={r.key} className={`tab${range === r.key ? ' on' : ''}`} onClick={() => setRange(r.key)}
            style={{ background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', fontFamily: 'inherit' }}>
            {r.label}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-e" style={{ marginBottom: 14 }}>{error}</div>}

      {data && data.configured === false ? (
        <div className="card"><div className="card-body" style={{ lineHeight: 1.7, fontSize: 13 }}>
          <strong>Analytics isn&apos;t connected yet.</strong>
          <p style={{ margin: '8px 0 0' }}>
            The website already sends visits to Google Analytics. To show them here, set the
            <code> Ga4PropertyId</code> deploy parameter and store the service-account key in AWS SSM at
            <code> /cosmic/&lt;env&gt;/ga4-sa-key</code>, then redeploy the backend.
          </p>
        </div></div>
      ) : loading && !data ? (
        <p className="muted">Loading analytics…</p>
      ) : data && t && p ? (
        <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity .2s' }}>
          <div className="stats">
            <Stat label="Unique visitors" value={fmt(t.activeUsers)} cur={t.activeUsers} prev={p.activeUsers} prevLabel={meta.prev} />
            <Stat label="New visitors" value={fmt(t.newUsers)} cur={t.newUsers} prev={p.newUsers} prevLabel={meta.prev} />
            <Stat label="Visits" value={fmt(t.sessions)} cur={t.sessions} prev={p.sessions} prevLabel={meta.prev} />
            <Stat label="Page views" value={fmt(t.screenPageViews)} cur={t.screenPageViews} prev={p.screenPageViews} prevLabel={meta.prev} />
            <Stat label="Avg. time per visitor" value={duration(t.userEngagementDuration / (t.activeUsers || 1))}
                  cur={t.userEngagementDuration / (t.activeUsers || 1)} prev={p.userEngagementDuration / (p.activeUsers || 1)} prevLabel={meta.prev} />
          </div>

          <div className="card" style={{ marginBottom: 18 }}>
            <div className="card-head"><h2>Visitors {data.trendUnit === 'hour' ? 'by hour' : 'per day'}</h2></div>
            <div style={{ padding: '8px 8px 0' }}><TrendChart data={data.trend} unit={data.trendUnit} /></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
            <BarList title="Countries" rows={data.countries} valueLabel="Visitors"
              name={r => <>{flag(r.code)}&nbsp; {r.country === '(not set)' ? 'Unknown' : r.country}</>} value={r => r.users} />
            <BarList title="Cities" rows={data.cities} valueLabel="Visitors"
              name={r => <>{flag(r.code)}&nbsp; {r.city === '(not set)' ? 'Unknown' : r.city}</>} value={r => r.users} />
            <BarList title="Top pages" rows={data.pages} valueLabel="Views"
              name={r => <a href={`https://thecosmicconnect.com${r.path}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{r.path}</a>}
              value={r => r.views} />
            <BarList title="How people found us" rows={data.channels} valueLabel="Visits" name={r => r.channel} value={r => r.sessions} />
            <BarList title="Top referrers" rows={data.sources} valueLabel="Visits"
              name={r => r.source === '(direct)' ? 'Direct (typed / bookmark)' : r.source} value={r => r.sessions} />
            <BarList title="Devices" rows={data.devices} valueLabel="Visitors"
              name={r => r.device.charAt(0).toUpperCase() + r.device.slice(1)} value={r => r.users} />
          </div>

          <p className="muted" style={{ marginTop: 16, lineHeight: 1.6 }}>
            Source: Google Analytics 4. Refreshed every 10 minutes; today&apos;s numbers can lag by a few hours.
            Visitors who block trackers aren&apos;t counted, so real traffic is slightly higher.
          </p>
        </div>
      ) : null}
    </Shell>
  )
}
