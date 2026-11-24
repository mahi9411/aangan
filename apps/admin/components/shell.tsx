'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { clearTokens } from '../lib/api'

const links = [
  ['/', 'Overview'],
  ['/bookings', 'Bookings'],
  ['/providers', 'Providers'],
  ['/customers', 'Customers'],
  ['/catalog', 'Catalog'],
  ['/payments', 'Payments'],
  ['/payouts', 'Payouts'],
  ['/reports', 'Reports'],
  ['/cities', 'Cities'],
]

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="flex flex-col bg-ink text-sand md:min-h-screen">
        <div className="flex items-center gap-3 px-5 py-6">
          <svg viewBox="0 0 32 32" className="arch text-clay" aria-hidden>
            <path d="M6 26V14c0-6 20-6 20 0v12" fill="none" stroke="currentColor" strokeWidth="2.4" />
            <path d="M6 26h20" stroke="currentColor" strokeWidth="2.4" />
          </svg>
          <div>
            <p className="font-display text-xl leading-none">Aangan</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-gold">Jaipur ops</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-auto px-3 pb-4 md:block">
          {links.map(([href, label]) => {
            const active = href === '/' ? path === '/' : path.startsWith(href)
            return (
              <Link key={href} href={href} className={`block whitespace-nowrap rounded-xl px-3 py-2 text-sm ${active ? 'bg-white/10 text-white' : 'text-sand/70 hover:text-white'}`}>
                {label}
              </Link>
            )
          })}
        </nav>
        <button
          className="m-3 mt-auto rounded-xl px-3 py-2 text-left text-sm text-sand/70 hover:text-white"
          onClick={() => {
            clearTokens()
            router.replace('/login')
          }}
        >
          Sign out
        </button>
      </aside>
      <main className="px-4 py-6 md:px-8">{children}</main>
    </div>
  )
}

export function PageTitle({ kicker, title, action }: { kicker: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-gold">{kicker}</p>
        <h1 className="font-display text-4xl text-ink">{title}</h1>
      </div>
      {action}
    </div>
  )
}
