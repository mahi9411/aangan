'use client'

import { useEffect, useState } from 'react'
import { PageTitle } from '../../../components/shell'
import { api } from '../../../lib/api'

type City = { id: string; name: string; slug: string; state: string; isActive: boolean; serviceRadiusKm: number; centerLat: number; centerLng: number }

export default function CitiesPage() {
  const [cities, setCities] = useState<City[]>([])
  const [form, setForm] = useState({ name: '', slug: '', state: '', centerLat: '', centerLng: '', serviceRadiusKm: '25' })
  const [error, setError] = useState('')
  function load() { api<City[]>('/admin/cities').then(setCities).catch((err) => setError(err.message)) }
  useEffect(load, [])
  return (
    <div>
      <PageTitle kicker="Expansion" title="Cities" />
      {error ? <p className="mb-3 text-clay">{error}</p> : null}
      <div className="grid gap-3">
        {cities.map((city) => (
          <article key={city.id} className="panel flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{city.name}, {city.state}</p>
              <p className="text-xs text-mute">{city.centerLat}, {city.centerLng} · {city.serviceRadiusKm} km</p>
            </div>
            <button className="btn-ghost" onClick={async () => { await api(`/admin/cities/${city.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !city.isActive }) }); load() }}>
              {city.isActive ? 'Live' : 'Paused'}
            </button>
          </article>
        ))}
      </div>
      <form className="panel mt-6 grid gap-3 p-5 md:grid-cols-3" onSubmit={async (event) => {
        event.preventDefault()
        setError('')
        try {
          await api('/admin/cities', { method: 'POST', body: JSON.stringify({ ...form, centerLat: Number(form.centerLat), centerLng: Number(form.centerLng), serviceRadiusKm: Number(form.serviceRadiusKm) }) })
          setForm({ name: '', slug: '', state: '', centerLat: '', centerLng: '', serviceRadiusKm: '25' })
          load()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not add the city')
        }
      }}>
        <h2 className="font-display text-2xl md:col-span-3">Open another city</h2>
        {(['name', 'slug', 'state', 'centerLat', 'centerLng', 'serviceRadiusKm'] as const).map((key) => (
          <input key={key} className="field" placeholder={key} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
        ))}
        <button className="btn-primary md:col-span-3">Add city</button>
      </form>
    </div>
  )
}
