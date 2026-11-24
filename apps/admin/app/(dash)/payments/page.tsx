'use client'

import { useEffect, useState } from 'react'
import { PageTitle } from '../../../components/shell'
import { api } from '../../../lib/api'
import { formatInr, when } from '../../../lib/format'

type Payment = {
  id: string
  status: string
  amountPaise: number
  commissionPaise: number
  providerPaise: number
  method: string | null
  createdAt: string
  booking: { serviceName: string }
}

export default function PaymentsPage() {
  const [items, setItems] = useState<Payment[]>([])
  const [reason, setReason] = useState('Customer goodwill')
  function load() {
    api<{ items: Payment[] }>('/admin/payments').then((result) => setItems(result.items))
  }
  useEffect(load, [])
  return (
    <div>
      <PageTitle kicker="Money" title="Payments" />
      <div className="panel overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-mute"><tr><th className="px-4 py-3">When</th><th>Job</th><th>Amount</th><th>Commission</th><th>Provider</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {items.map((payment) => (
              <tr key={payment.id} className="border-t border-line">
                <td className="px-4 py-3">{when(payment.createdAt)}</td>
                <td>{payment.booking.serviceName}<div className="text-xs text-mute">{payment.method}</div></td>
                <td>{formatInr(payment.amountPaise)}</td>
                <td>{formatInr(payment.commissionPaise)}</td>
                <td>{formatInr(payment.providerPaise)}</td>
                <td><span className="pill">{payment.status}</span></td>
                <td className="py-3 pr-4 text-right">
                  {payment.status === 'CAPTURED' ? <button className="btn-ghost" onClick={async () => { await api(`/admin/payments/${payment.id}/refund`, { method: 'POST', body: JSON.stringify({ reason }) }); load() }}>Refund</button> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label className="mt-3 block max-w-sm text-sm">Refund reason<input className="field mt-1" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
    </div>
  )
}
