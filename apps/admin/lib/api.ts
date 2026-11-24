export type Tokens = { accessToken: string; refreshToken: string }

const KEY = 'aangan.admin.tokens'

function isLanHost(host: string) {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)
}

export function apiBase() {
  const configured = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'
  if (typeof window !== 'undefined' && isLanHost(window.location.hostname)) {
    return `${window.location.protocol}//${window.location.hostname}:4000/v1`
  }
  return configured
}

export function getTokens(): Tokens | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(KEY)
  return raw ? (JSON.parse(raw) as Tokens) : null
}

export function setTokens(tokens: Tokens) {
  localStorage.setItem(KEY, JSON.stringify(tokens))
}

export function clearTokens() {
  localStorage.removeItem(KEY)
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message)
  }
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const tokens = getTokens()
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (tokens?.accessToken) headers.set('Authorization', `Bearer ${tokens.accessToken}`)
  let response: Response
  try {
    response = await fetch(`${apiBase()}${path}`, { ...init, headers })
  } catch {
    throw new ApiError(`Cannot reach the API at ${apiBase()}`, 0, 'NETWORK')
  }
  if (response.status === 401 && retry && tokens?.refreshToken) {
    const refreshed = await fetch(`${apiBase()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    })
    if (refreshed.ok) {
      const next = (await refreshed.json()) as Tokens
      setTokens({ ...tokens, ...next })
      return api<T>(path, init, false)
    }
    clearTokens()
  }
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null
  if (!response.ok) {
    throw new ApiError(payload?.error?.message ?? 'Request failed', response.status, payload?.error?.code)
  }
  return payload as T
}
