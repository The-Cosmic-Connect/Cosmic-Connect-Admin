import { useEffect, useState } from 'react'
import Shell from '@/components/Shell'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function Dashboard() {
  const [s, setS] = useState({ products: '—', orders: '—', posts: '—', inbox: '—' })

  useEffect(() => {
    const safe = (p: Promise<any>, fn: (d: any) => number) =>
      p.then(r => r.json()).then(fn).catch(() => 0)

    Promise.all([
      safe(fetch(`${API}/products?published_only=false`), d => (d.products || d).length),
      safe(fetch(`${API}/orders`), d => (Array.isArray(d) ? d : d.orders || []).length),
      safe(fetch(`${API}/blog`), d => (d.posts || d).length),
      // inbox = bookings + course inquiries + contact messages (backend stores them)
      safe(fetch(`${API}/inbox`), d => (d.items || []).length),
    ]).then(([products, orders, posts, inbox]) =>
      setS({ products: String(products), orders: String(orders), posts: String(posts), inbox: String(inbox) })
    )
  }, [])

  return (
    <Shell title="Dashboard">
      <div className="ph">
        <div><h1>Dashboard</h1><p>Welcome back.</p></div>
      </div>

      <div className="stats">
        {[
          { n: s.products, l: 'Products',  href: '/admin/shop',  c: '#5b21b6' },
          { n: s.orders,   l: 'Orders',    href: '/admin/shop?t=orders', c: '#1d4ed8' },
          { n: s.posts,    l: 'Blog Posts',href: '/admin/blog',  c: '#065f46' },
          { n: s.inbox,    l: 'Inbox',     href: '/admin/inbox', c: '#92400e' },
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
            { label: '+ New Product',  href: '/admin/shop?new=product' },
            { label: '+ New Coupon',   href: '/admin/shop?new=coupon' },
            { label: '+ New Post',     href: '/admin/blog?new=1' },
            { label: 'View Inbox',     href: '/admin/inbox' },
          ].map(({ label, href }) => (
            <Link key={label} href={href} className="btn btn-s">{label}</Link>
          ))}
        </div>
      </div>
    </Shell>
  )
}