'use client'

import { useEffect, useState } from 'react'
import { PageTitle } from '../../../components/shell'
import { api } from '../../../lib/api'
import { formatInr, rupeesToPaise } from '../../../lib/format'

type Catalog = Array<{
  id: string
  name: string
  services: Array<{ id: string; name: string; pricingType: 'FIXED' | 'QUOTATION'; prices: Array<{ cityId: string; pricePaise: number | null; commissionBps: number; isActive: boolean }> }>
}>
type City = { id: string; name: string }

export default function CatalogPage() {
  const [catalog, setCatalog] = useState<Catalog>([])
  const [cities, setCities] = useState<City[]>([])
  const [cityId, setCityId] = useState('')
  const [form, setForm] = useState({ categoryId: '', name: '', slug: '', description: '', pricingType: 'FIXED', estimatedMinutes: 60, highlights: 'Verified professional,Pay after the work' })
  const [error, setError] = useState('')

  function load() {
    Promise.all([api<Catalog>('/admin/catalog'), api<City[]>('/admin/cities')]).then(([nextCatalog, nextCities]) => {
      setCatalog(nextCatalog)
      setCities(nextCities)
      setCityId((current) => current || nextCities[0]?.id || '')
      setForm((current) => ({ ...current, categoryId: current.categoryId || nextCatalog[0]?.id || '' }))
    }).catch((err) => setError(err.message))
  }
  useEffect(load, [])

  async function savePrice(serviceId: string, pricingType: string, rupees: string, bps: string) {
    await api('/admin/prices', {
      method: 'POST',
      body: JSON.stringify({
        cityId,
        serviceId,
        pricePaise: pricingType === 'QUOTATION' ? null : rupeesToPaise(rupees || '0'),
        commissionBps: Number(bps),
        isActive: true,
      }),
    })
    load()
  }

  async function addService(event: React.FormEvent) {
    event.preventDefault()
    await api('/admin/services', {
      method: 'POST',
      body: JSON.stringify({ ...form, estimatedMinutes: Number(form.estimatedMinutes), highlights: form.highlights.split(',').map((item) => item.trim()).filter(Boolean) }),
    })
    load()
  }

  return (
    <div>
      <PageTitle kicker="Offer" title="Services and prices" action={
        <select className="field w-auto" value={cityId} onChange={(event) => setCityId(event.target.value)}>
          {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
        </select>
      } />
      {error ? <p className="mb-4 text-clay">{error}</p> : null}
      {catalog.map((category) => (
        <section key={category.id} className="mb-6">
          <h2 className="mb-2 font-display text-2xl">{category.name}</h2>
          <div className="panel divide-y divide-line">
            {category.services.map((service) => {
              const price = service.prices.find((item) => item.cityId === cityId)
              return (
                <form key={service.id} className="grid gap-2 p-4 md:grid-cols-[1.4fr_120px_120px_auto] md:items-center" onSubmit={(event) => {
                  event.preventDefault()
                  const data = new FormData(event.currentTarget)
                  savePrice(service.id, service.pricingType, String(data.get('rupees') ?? ''), String(data.get('bps') ?? '1500')).catch((err) => setError(err.message))
                }}>
                  <div>
                    <p className="font-medium">{service.name}</p>
                    <p className="text-xs text-mute">{service.pricingType} · {price ? formatInr(price.pricePaise) : 'Not priced'}</p>
                  </div>
                  <input className="field" name="rupees" placeholder="Rupees" defaultValue={price?.pricePaise != null ? String(price.pricePaise / 100) : ''} disabled={service.pricingType === 'QUOTATION'} />
                  <input className="field" name="bps" placeholder="Commission bps" defaultValue={price?.commissionBps ?? 1500} />
                  <button className="btn-ghost">Save</button>
                </form>
              )
            })}
          </div>
        </section>
      ))}
      <form className="panel grid gap-3 p-5 md:grid-cols-2" onSubmit={addService}>
        <h2 className="font-display text-2xl md:col-span-2">Add a service</h2>
        <select className="field" value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
          {catalog.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <input className="field" placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <input className="field" placeholder="slug" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} />
        <select className="field" value={form.pricingType} onChange={(event) => setForm({ ...form, pricingType: event.target.value })}>
          <option value="FIXED">FIXED</option>
          <option value="QUOTATION">QUOTATION</option>
        </select>
        <input className="field md:col-span-2" placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <button className="btn-primary md:col-span-2">Add service</button>
      </form>
    </div>
  )
}
