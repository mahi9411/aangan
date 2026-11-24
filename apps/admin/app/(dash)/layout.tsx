'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shell } from '../../components/shell'
import { getTokens } from '../../lib/api'

export default function DashLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!getTokens()) router.replace('/login')
    else setReady(true)
  }, [router])
  if (!ready) return <div className="grid min-h-screen place-items-center text-mute">Opening the desk…</div>
  return <Shell>{children}</Shell>
}
