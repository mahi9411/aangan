'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageTitle } from '../../components/shell'
import { api } from '../../lib/api'
import { formatInr } from '../../lib/format'

type Overview = {
  counts: { customers: number; providers: number; pendingKyc: number; liveJobs: number; searching: number }
  today: { gmvPaise: number; commissionPaise: number; bookingsPaid: number }
  recentBookings: Array<{ id: string; status: string; serviceName: string; areaLabel: string; pricePaise: number | null; customerName: string | null; createdAt: string }>
}

export default function OverviewPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    api<Overview>('/admin/overview').then(setData).catch((err) => setError(err.message))
  }, [])
  if (error) return <p className="text-clay">{error}</p>
  if (!data) return <p className="text-mute">Loading the city…</p>
  const cards = [
    ['GMV today', formatInr(data.today.gmvPaise)],
    ['Commission today', formatInr(data.today.commissionPaise)],
    ['Paid jobs', String(data.today.bookingsPaid)],
    ['Searching now', String(data.counts.searching)],
    ['Live jobs', String(data.counts.liveJobs)],
    ['KYC waiting', String(data.counts.pendingKyc)],
    ['Customers', String(data.counts.customers)],
    ['Providers', String(data.counts.providers)],
  ]
  return (
    <div>
      <PageTitle kicker="Today in Jaipur" title="The courtyard is open." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <article key={label} className="panel p-4">
            <p className="text-xs uppercase tracking-wider text-mute">{label}</p>
            <p className="mt-2 font-display text-3xl">{value}</p>
          </article>
        ))}
      </div>
      <section className="panel mt-6 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-mute">
            <tr><th className="px-4 py-3">Service</th><th>Area</th><th>Customer</th><th>Status</th><th>Price</th></tr>
          </thead>
          <tbody>
            {data.recentBookings.map((booking) => (
              <tr key={booking.id} className="border-t border-line">
                <td className="px-4 py-3"><Link className="underline decoration-line underline-offset-4" href={`/bookings/${booking.id}`}>{booking.serviceName}</Link></td>
                <td>{booking.areaLabel}</td>
                <td>{booking.customerName}</td>
                <td><span className="pill">{booking.status}</span></td>
                <td>{formatInr(booking.pricePaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
