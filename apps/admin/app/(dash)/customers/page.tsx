'use client'

import { useEffect, useState } from 'react'
import { PageTitle } from '../../../components/shell'
import { api } from '../../../lib/api'

type User = { id: string; name: string | null; phone: string; isActive: boolean; createdAt: string }

export default function CustomersPage() {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<User[]>([])
  function load(query = q) {
    api<{ items: User[] }>(`/admin/users?role=CUSTOMER&q=${encodeURIComponent(query)}`).then((result) => setItems(result.items))
  }
  useEffect(() => { load('') }, [])
  return (
    <div>
      <PageTitle kicker="People" title="Customers" action={<form onSubmit={(event) => { event.preventDefault(); load() }}><input className="field" placeholder="Name or phone" value={q} onChange={(event) => setQ(event.target.value)} /></form>} />
      <div className="panel overflow-auto">
        <table className="w-full text-left text-sm">
          <tbody>
            {items.map((user) => (
              <tr key={user.id} className="border-t border-line">
                <td className="px-4 py-3">{user.name ?? 'New customer'}<div className="text-xs text-mute">{user.phone}</div></td>
                <td>{user.isActive ? 'Active' : 'Suspended'}</td>
                <td className="py-3 pr-4 text-right">
                  <button className="btn-ghost" onClick={async () => { await api(`/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !user.isActive }) }); load() }}>
                    {user.isActive ? 'Suspend' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
