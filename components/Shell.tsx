import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import {
  ShoppingBag, FileText, Inbox, Settings, LayoutDashboard,
  LogOut, ExternalLink, Users, Calendar, Briefcase
} from 'lucide-react'
import { isAuthed, clearSession } from '@/lib/auth'

const NAV = [
  { href: '/admin',           icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/shop',      icon: ShoppingBag,     label: 'Shop' },
  { href: '/admin/agents',    icon: Users,           label: 'Agents' },
  { href: '/admin/services',  icon: Briefcase,       label: 'Services' },
  { href: '/admin/bookings',  icon: Calendar,        label: 'Bookings' },
  { href: '/admin/blog',      icon: FileText,        label: 'Blog' },
  { href: '/admin/inbox',     icon: Inbox,           label: 'Inbox' },
  { href: '/admin/settings',  icon: Settings,        label: 'Settings' },
]

export default function Shell({ children, title }: { children: React.ReactNode; title: string }) {
  const router = useRouter()
  useEffect(() => {
    if (!isAuthed()) router.replace('/login')
  }, [router])
  function logout() { clearSession(); router.replace('/login') }

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <div className="brand-name">Cosmic Connect</div>
          <div className="brand-sub">Admin</div>
        </div>
        <nav className="nav">
          {NAV.map(({ href, icon: Icon, label }) => {
            const on = router.pathname === href || (href !== '/admin' && router.pathname.startsWith(href))
            return (
              <Link key={href} href={href} className={`nav-link ${on ? 'on' : ''}`}>
                <Icon />{label}
              </Link>
            )
          })}
        </nav>
        <div className="nav-foot">
          <button className="nav-link" onClick={logout} style={{ width: '100%' }}>
            <LogOut />Logout
          </button>
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <span style={{ fontWeight: 600, fontSize: 13 }}>{title}</span>
          <a href="https://www.arkasuryacrystals.com" target="_blank" rel="noopener noreferrer"
            className="btn btn-s btn-sm flex gap2">
            <ExternalLink size={12} /> View Site
          </a>
        </div>
        <div className="page">{children}</div>
      </div>
    </div>
  )
}