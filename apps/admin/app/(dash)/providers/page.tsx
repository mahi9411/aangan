'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageTitle } from '../../../components/shell'
import { api } from '../../../lib/api'

type Provider = { id: string; name: string | null; phone: string; kycStatus: string; isOnline: boolean; ratingAvg: number; jobsCompleted: number; skills: string[]; areas: string[] }

export default function ProvidersPage() {
  const [kyc, setKyc] = useState('SUBMITTED')
  const [items, setItems] = useState<Provider[]>([])
  useEffect(() => {
    api<{ items: Provider[] }>(`/admin/providers?kyc=${kyc}`).then((result) => setItems(result.items))
  }, [kyc])
  return (
    <div>
      <PageTitle kicker="People" title="Providers" action={
        <select className="field w-auto" value={kyc} onChange={(event) => setKyc(event.target.value)}>
          {['SUBMITTED','APPROVED','REJECTED','PENDING'].map((item) => <option key={item}>{item}</option>)}
        </select>
      } />
      <div className="grid gap-3">
        {items.map((provider) => (
          <Link key={provider.id} href={`/providers/${provider.id}`} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium">{provider.name}</p>
              <p className="text-sm text-mute">{provider.phone} · {provider.areas.join(', ') || 'No area yet'}</p>
            </div>
            <div className="text-right text-sm">
              <span className="pill">{provider.kycStatus}</span>
              <p className="mt-1 text-mute">{provider.ratingAvg.toFixed(1)} · {provider.jobsCompleted} jobs</p>
            </div>
          </Link>
        ))}
        {items.length === 0 ? <p className="text-mute">Nobody in this queue.</p> : null}
      </div>
    </div>
  )
}
