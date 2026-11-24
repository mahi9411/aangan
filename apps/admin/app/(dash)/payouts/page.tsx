'use client'

import { useEffect, useState } from 'react'
import { PageTitle } from '../../../components/shell'
import { api } from '../../../lib/api'
import { formatInr, rupeesToPaise, when } from '../../../lib/format'

type Balance = { providerId: string; name: string | null; phone: string | null; balancePaise: number; accountLast4: string | null; ifsc: string | null }
type Payout = { id: string; amountPaise: number; status: string; reference: string | null; createdAt: string; provider: { name: string | null } }

export default function PayoutsPage() {
  const [balances, setBalances] = useState<Balance[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [amount, setAmount] = useState('500')
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')

  function load() {
    api<{ balances: Balance[]; payouts: Payout[] }>('/admin/payouts').then((result) => {
      setBalances(result.balances)
      setPayouts(result.payouts)
    }).catch((err) => setError(err.message))
  }
  useEffect(load, [])

  return (
    <div>
      <PageTitle kicker="Money" title="Payouts" />
      {error ? <p className="mb-3 text-clay">{error}</p> : null}
      <p className="mb-4 max-w-2xl text-sm text-mute">Balances are ledger earnings minus payouts already marked paid. Record the bank UTR after you transfer. RazorpayX can replace this manual step later.</p>
      <div className="grid gap-3">
        {balances.map((row) => (
          <form key={row.providerId} className="panel flex flex-wrap items-center justify-between gap-3 p-4" onSubmit={async (event) => {
            event.preventDefault()
            setError('')
            try {
              await api('/admin/payouts', { method: 'POST', body: JSON.stringify({ providerId: row.providerId, amountPaise: rupeesToPaise(amount), note: 'Manual NEFT' }) })
              load()
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not create payout')
            }
          }}>
            <div>
              <p className="font-medium">{row.name}</p>
              <p className="text-xs text-mute">{row.phone} · A/c {row.accountLast4 ?? '—'} · {row.ifsc}</p>
            </div>
            <p className="font-display text-2xl">{formatInr(row.balancePaise)}</p>
            <button className="btn-ghost">Queue {amount ? `₹${amount}` : 'payout'}</button>
          </form>
        ))}
      </div>
      <label className="mt-4 block max-w-xs text-sm">Queue amount in rupees<input className="field mt-1" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      <section className="panel mt-6 overflow-auto">
        <table className="w-full text-left text-sm">
          <tbody>
            {payouts.map((payout) => (
              <tr key={payout.id} className="border-t border-line">
                <td className="px-4 py-3">{when(payout.createdAt)}<div className="text-xs text-mute">{payout.provider.name}</div></td>
                <td>{formatInr(payout.amountPaise)}</td>
                <td><span className="pill">{payout.status}</span></td>
                <td className="py-3 pr-4 text-right">
                  {payout.status === 'PENDING' ? (
                    <span className="inline-flex gap-2">
                      <input className="field w-36" placeholder="UTR" value={reference} onChange={(event) => setReference(event.target.value)} />
                      <button className="btn-primary" onClick={async () => { await api(`/admin/payouts/${payout.id}/mark-paid`, { method: 'POST', body: JSON.stringify({ reference }) }); setReference(''); load() }}>Mark paid</button>
                    </span>
                  ) : payout.reference}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
