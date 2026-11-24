'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, setTokens } from '../../lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('9000000001')
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState('')
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function requestCode() {
    setBusy(true)
    setError('')
    try {
      const result = await api<{ devCode?: string }>('/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ phone, role: 'ADMIN' }),
      })
      setDevCode(result.devCode ?? '')
      setStep('code')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the code')
    } finally {
      setBusy(false)
    }
  }

  async function verify() {
    setBusy(true)
    setError('')
    try {
      const result = await api<{ accessToken: string; refreshToken: string }>('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone, role: 'ADMIN', code }),
      })
      setTokens(result)
      router.replace('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <section className="panel w-full max-w-md p-8">
        <p className="text-xs uppercase tracking-[0.18em] text-gold">Aangan</p>
        <h1 className="mt-2 font-display text-4xl">Ops desk</h1>
        <p className="mt-2 text-sm text-mute">Jaipur launch. Sign in with the ops mobile number.</p>
        {step === 'phone' ? (
          <label className="mt-6 block text-sm">
            Mobile number
            <input className="field mt-2" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="numeric" />
          </label>
        ) : (
          <label className="mt-6 block text-sm">
            6-digit code
            <input className="field mt-2 tracking-[0.3em]" value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" />
            {devCode ? <span className="mt-2 block text-xs text-mute">Dev code {devCode}</span> : null}
          </label>
        )}
        {error ? <p className="mt-3 text-sm text-clay">{error}</p> : null}
        <button className="btn-primary mt-6 w-full" disabled={busy} onClick={step === 'phone' ? requestCode : verify}>
          {busy ? 'Please wait' : step === 'phone' ? 'Send code' : 'Enter'}
        </button>
      </section>
    </main>
  )
}
