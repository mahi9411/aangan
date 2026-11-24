'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { PageTitle } from '../../../../components/shell'
import { api } from '../../../../lib/api'

type Detail = {
  user: { name: string | null; phone: string }
  kycStatus: string
  rejectionReason: string | null
  bio: string | null
  experienceYears: number
  isOnline: boolean
  skills: Array<{ service: { name: string } }>
  areas: Array<{ label: string; radiusKm: number }>
  documents: Array<{ id: string; type: string; status: string }>
}

export default function ProviderDetailPage() {
  const params = useParams<{ id: string }>()
  const [profile, setProfile] = useState<Detail | null>(null)
  const [reason, setReason] = useState('')
  const [account, setAccount] = useState<string>('')
  const [error, setError] = useState('')

  function load() {
    api<Detail>(`/admin/providers/${params.id}`).then(setProfile).catch((err) => setError(err.message))
  }
  useEffect(load, [params.id])

  async function review(status: 'APPROVED' | 'REJECTED') {
    await api(`/admin/providers/${params.id}/kyc`, { method: 'POST', body: JSON.stringify({ status, reason }) })
    load()
  }
  async function reveal() {
    const result = await api<{ accountName: string; accountNumber: string; ifsc: string; upiId: string | null }>(`/admin/providers/${params.id}/payout-account`, { method: 'POST' })
    setAccount(`${result.accountName} · ${result.accountNumber} · ${result.ifsc} · ${result.upiId ?? 'no UPI'}`)
  }

  if (error) return <p className="text-clay">{error}</p>
  if (!profile) return <p className="text-mute">Loading profile…</p>
  return (
    <div>
      <PageTitle kicker={profile.kycStatus} title={profile.user.name ?? 'Provider'} />
      <section className="panel p-5">
        <p>{profile.user.phone}</p>
        <p className="mt-2 text-mute">{profile.bio}</p>
        <p className="mt-3 text-sm">{profile.experienceYears} years · {profile.isOnline ? 'Online' : 'Offline'}</p>
        <p className="mt-3 text-sm">{profile.skills.map((skill) => skill.service.name).join(' · ')}</p>
        <p className="mt-1 text-sm text-mute">{profile.areas.map((area) => `${area.label} (${area.radiusKm} km)`).join(', ')}</p>
        <ul className="mt-4 text-sm">{profile.documents.map((document) => <li key={document.id}>{document.type} · {document.status}</li>)}</ul>
        {profile.kycStatus === 'SUBMITTED' ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <input className="field max-w-sm" placeholder="Reason if rejecting" value={reason} onChange={(event) => setReason(event.target.value)} />
            <button className="btn-primary" onClick={() => review('APPROVED')}>Approve</button>
            <button className="btn-ghost" onClick={() => review('REJECTED')}>Reject</button>
          </div>
        ) : null}
        <button className="btn-ghost mt-4" onClick={reveal}>Reveal payout account</button>
        {account ? <p className="mt-2 text-sm">{account}</p> : null}
        {profile.rejectionReason ? <p className="mt-3 text-sm text-clay">{profile.rejectionReason}</p> : null}
      </section>
    </div>
  )
}
