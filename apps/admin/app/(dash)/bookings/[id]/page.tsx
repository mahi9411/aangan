'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { PageTitle } from '../../../../components/shell'
import { api } from '../../../../lib/api'
import { formatInr, when } from '../../../../lib/format'

type Detail = {
  id: string
  status: string
  serviceName: string
  issueDescription: string
  pricePaise: number | null
  mode: string
  address: { line: string | null; area: string; lat: number | null; lng: number | null; mapsUrl: string | null }
  customer: { name: string | null; phone: string | null }
  provider: { name: string | null; phone: string | null } | null
  events: Array<{ id: string; message: string; createdAt: string }>
  permissions: { canCancel: boolean }
}

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>()
  const [booking, setBooking] = useState<Detail | null>(null)
  const [reason, setReason] = useState('Ops cancellation')
  const [error, setError] = useState('')

  function load() {
    api<Detail>(`/admin/bookings/${params.id}`).then(setBooking).catch((err) => setError(err.message))
  }
  useEffect(load, [params.id])

  async function cancel() {
    await api(`/admin/bookings/${params.id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) })
    load()
  }

  if (error) return <p className="text-clay">{error}</p>
  if (!booking) return <p className="text-mute">Loading booking…</p>
  return (
    <div>
      <PageTitle kicker={booking.mode} title={booking.serviceName} />
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="panel p-5">
          <span className="pill">{booking.status}</span>
          <p className="mt-4 text-lg">{booking.issueDescription}</p>
          <p className="mt-4 font-display text-3xl">{formatInr(booking.pricePaise)}</p>
          <p className="mt-4 text-sm">{booking.address.line ?? booking.address.area}</p>
          {booking.address.mapsUrl ? <a className="mt-2 inline-block text-sm text-pine underline" href={booking.address.mapsUrl} target="_blank">Open in Google Maps</a> : null}
          <div className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
            <p>Customer<br /><strong>{booking.customer.name}</strong><br />{booking.customer.phone}</p>
            <p>Provider<br /><strong>{booking.provider?.name ?? 'Unassigned'}</strong><br />{booking.provider?.phone}</p>
          </div>
          {booking.permissions.canCancel ? (
            <div className="mt-6 flex gap-2">
              <input className="field" value={reason} onChange={(event) => setReason(event.target.value)} />
              <button className="btn-ghost" onClick={cancel}>Cancel</button>
            </div>
          ) : null}
        </section>
        <section className="panel p-5">
          <h2 className="font-display text-2xl">Timeline</h2>
          <ol className="mt-4 space-y-3">
            {booking.events.map((event) => (
              <li key={event.id}>
                <p>{event.message}</p>
                <p className="text-xs text-mute">{when(event.createdAt)}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}
