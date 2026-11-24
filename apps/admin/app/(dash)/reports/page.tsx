'use client'

import { useEffect, useState } from 'react'
import { PageTitle } from '../../../components/shell'
import { api } from '../../../lib/api'
import { formatInr } from '../../../lib/format'

type Report = {
  gmvPaise: number
  commissionPaise: number
  gstPaise: number
  providerPaise: number
  capturedCount: number
  refundPaise: number
  newCustomers: number
  newProviders: number
  bookingsByStatus: Array<{ status: string; count: number }>
  bookingsByService: Array<{ service: string; count: number; gmv: number }>
  daily: Array<{ date: string; gmvPaise: number; count: number }>
}

export default function ReportsPage() {
  const [report, setReport] = useState<Report | null>(null)
  useEffect(() => { api<Report>('/admin/reports').then(setReport) }, [])
  if (!report) return <p className="text-mute">Adding up the books…</p>
  const max = Math.max(...report.daily.map((day) => day.gmvPaise), 1)
  return (
    <div>
      <PageTitle kicker="Last 30 days" title="Reports" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['GMV', formatInr(report.gmvPaise)],
          ['Commission', formatInr(report.commissionPaise)],
          ['GST on commission', formatInr(report.gstPaise)],
          ['Provider earnings', formatInr(report.providerPaise)],
          ['Refunds', formatInr(report.refundPaise)],
          ['New customers', String(report.newCustomers)],
        ].map(([label, value]) => (
          <article key={label} className="panel p-4"><p className="text-xs uppercase tracking-wider text-mute">{label}</p><p className="mt-2 font-display text-3xl">{value}</p></article>
        ))}
      </div>
      <section className="panel mt-6 p-5">
        <h2 className="font-display text-2xl">Daily GMV</h2>
        <div className="mt-4 flex h-40 items-end gap-2">
          {report.daily.map((day) => (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
              <div className="w-full rounded-t bg-clay" style={{ height: `${Math.max(8, (day.gmvPaise / max) * 100)}%` }} title={formatInr(day.gmvPaise)} />
              <span className="text-[10px] text-mute">{new Date(day.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}</span>
            </div>
          ))}
          {report.daily.length === 0 ? <p className="text-sm text-mute">No captured payments in this window.</p> : null}
        </div>
      </section>
      <section className="panel mt-4 p-5">
        <h2 className="font-display text-2xl">By service</h2>
        {report.bookingsByService.map((row) => (
          <div key={row.service} className="mt-3 flex justify-between text-sm"><span>{row.service}</span><span>{row.count} · {formatInr(row.gmv)}</span></div>
        ))}
      </section>
    </div>
  )
}
