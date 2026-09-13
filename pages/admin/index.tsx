import { useEffect, useState } from 'react'
import Shell from '@/components/Shell'
import Link from 'next/link'
import { getCachedProducts } from '@/lib/fetchProducts'
import { authedFetch } from '@/lib/auth'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function Dashboard() {
  // Seed the products counter from cache so the dashboard renders an instant
  // number when products were loaded recently (e.g. you just left the Shop tab).
  // The real /admin/dashboard call below will correct this if it's stale.
  const [s, setS] = useState(() => {
    const cached = getCachedProducts()
    return {
      products: cached ? String(cached.length) : '—',
      orders:   '—',
      posts:    '—',
      inbox:    '—',
    }
  })

  useEffect(() => {
    // Single round-trip for all four counters, instead of one call per
    // counter (products/orders/posts/inbox). Admin-only — carries the JWT.
    authedFetch(`${API}/admin/dashboard`)
      .then(r => r.json())
      .then(d => setS({
        products: String(d.products ?? '—'),
        orders:   String(d.orders   ?? '—'),
        posts:    String(d.posts    ?? '—'),
        inbox:    String(d.inbox    ?? '—'),
      }))
      .catch(() => {})
  }, [])

  return (
    <Shell title="Dashboard">
      <div className="ph">
        <div><h1>Dashboard</h1><p>Welcome back.</p></div>
      </div>

      <div className="stats">
        {[
          { n: s.products, l: 'Products',   href: '/admin/shop',           c: '#5b21b6' },
          { n: s.orders,   l: 'Orders',     href: '/admin/shop?t=orders',  c: '#1d4ed8' },
          { n: s.posts,    l: 'Blog Posts', href: '/admin/blog',           c: '#065f46' },
          { n: s.inbox,    l: 'Inbox',      href: '/admin/inbox',          c: '#92400e' },
        ].map(({ n, l, href, c }) => (
          <Link key={l} href={href} style={{ textDecoration: 'none' }}>
            <div className="stat" style={{ borderTop: `3px solid ${c}`, cursor: 'pointer' }}>
              <div className="stat-n" style={{ color: c }}>{n}</div>
              <div className="stat-l">{l}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="card">
        <div className="card-head"><h2>Quick Actions</h2></div>
        <div className="card-body flex flex-wrap gap2" style={{ flexWrap: 'wrap' }}>
          {[
            { label: '+ New Product', href: '/admin/shop?new=product' },
            { label: '+ New Coupon',  href: '/admin/shop?new=coupon'  },
            { label: '+ New Post',    href: '/admin/blog?new=1'       },
            { label: 'View Inbox',    href: '/admin/inbox'            },
          ].map(({ label, href }) => (
            <Link key={label} href={href} className="btn btn-s">{label}</Link>
          ))}
        </div>
      </div>
    </Shell>
  )
}
