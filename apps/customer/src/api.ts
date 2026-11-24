import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

export function devBase() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL
  const host = (Constants.expoConfig?.hostUri ?? '').split(':')[0]
  if (host && host !== 'localhost' && host !== '127.0.0.1') return `http://${host}:4000/v1`
  return 'http://localhost:4000/v1'
}

function usable(url: string | null) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return url.replace(/\/$/, '')
  } catch {
    return null
  }
}

async function read(key: string) {
  if (Platform.OS === 'web') return AsyncStorage.getItem(key)
  try {
    return await SecureStore.getItemAsync(key)
  } catch {
    return AsyncStorage.getItem(key)
  }
}

async function write(key: string, value: string) {
  if (Platform.OS === 'web') return AsyncStorage.setItem(key, value)
  try {
    await SecureStore.setItemAsync(key, value)
  } catch {
    await AsyncStorage.setItem(key, value)
  }
}

export async function getBase() {
  const stored = usable(await AsyncStorage.getItem('aangan.base'))
  const detected = devBase().replace(/\/$/, '')
  if (!stored) return detected
  const storedHost = new URL(stored).hostname
  const detectedHost = new URL(detected).hostname
  const local = storedHost === 'localhost' || storedHost === '127.0.0.1' || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(storedHost)
  if (local && detectedHost !== 'localhost' && storedHost !== detectedHost) return detected
  return stored
}

export async function setBase(url: string) {
  await AsyncStorage.setItem('aangan.base', url.replace(/\/$/, ''))
}

export type Session = { accessToken: string; refreshToken: string; user: { id: string; name: string | null; phone: string; role: string } }

export async function getSession(): Promise<Session | null> {
  const raw = await read('aangan.session')
  return raw ? JSON.parse(raw) : null
}

export async function saveSession(session: Session) {
  await write('aangan.session', JSON.stringify(session))
}

export async function clearSession() {
  if (Platform.OS === 'web') await AsyncStorage.removeItem('aangan.session')
  else {
    try { await SecureStore.deleteItemAsync('aangan.session') } catch { await AsyncStorage.removeItem('aangan.session') }
  }
}

export class ApiError extends Error {
  constructor(message: string, public code?: string) { super(message) }
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const session = await getSession()
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`)
  const base = await getBase()
  let response: Response
  try {
    response = await fetch(`${base}${path}`, { ...init, headers })
  } catch {
    throw new ApiError(`Cannot reach the API at ${base}`)
  }
  if (response.status === 401 && retry && session?.refreshToken) {
    const refreshed = await fetch(`${base}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    })
    if (refreshed.ok) {
      const tokens = await refreshed.json()
      await saveSession({ ...session, ...tokens })
      return api<T>(path, init, false)
    }
    await clearSession()
  }
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null
  if (!response.ok) throw new ApiError(payload?.error?.message ?? 'Request failed', payload?.error?.code)
  return payload as T
}

export async function uploadImage(uri: string, purpose: 'booking' | 'kyc') {
  const form = new FormData()
  form.append('file', { uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob)
  return api<{ url?: string; fileId?: string }>(`/uploads?purpose=${purpose}`, { method: 'POST', body: form })
}
