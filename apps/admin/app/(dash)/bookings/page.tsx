'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageTitle } from '../../../components/shell'
import { api } from '../../../lib/api'
import { formatInr, when } from '../../../lib/format'

type Booking = {
  id: string
  status: string
  serviceName: string
  areaLabel: string
  pricePaise: number | null
  mode: string
  createdAt: string
  customer: { name: string | null; phone: string }
  provider: { name: string | null } | null
}

export default function BookingsPage() {
  const [status, setStatus] = useState('')
  const [items, setItems] = useState<Booking[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    const query = status ? `?status=${status}` : ''
    api<{ items: Booking[] }>(`/admin/bookings${query}`).then((result) => setItems(result.items)).catch((err) => setError(err.message))
  }, [status])
  return (
    <div>
      <PageTitle kicker="Jobs" title="Bookings" action={
        <select className="field w-auto" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {['SEARCHING','ACCEPTED','QUOTATION_PENDING','QUOTATION_APPROVED','EN_ROUTE','IN_PROGRESS','AWAITING_PAYMENT','PAID','CANCELLED','EXPIRED','REFUNDED'].map((item) => <option key={item}>{item}</option>)}
        </select>
      } />
      {error ? <p className="text-clay">{error}</p> : null}
      <div className="panel overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-mute"><tr><th className="px-4 py-3">When</th><th>Service</th><th>Customer</th><th>Provider</th><th>Status</th><th>Price</th></tr></thead>
          <tbody>
            {items.map((booking) => (
              <tr key={booking.id} className="border-t border-line">
                <td className="px-4 py-3">{when(booking.createdAt)}</td>
                <td><Link className="underline decoration-line underline-offset-4" href={`/bookings/${booking.id}`}>{booking.serviceName}</Link><div className="text-xs text-mute">{booking.areaLabel} · {booking.mode}</div></td>
                <td>{booking.customer.name}<div className="text-xs text-mute">{booking.customer.phone}</div></td>
                <td>{booking.provider?.name ?? '—'}</td>
                <td><span className="pill">{booking.status}</span></td>
                <td>{formatInr(booking.pricePaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
