import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

function keyFor(secret: string) {
  return createHash('sha256').update(secret).digest()
}

export function encryptField(plain: string, secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyFor(secret), iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`
}

export function decryptField(payload: string, secret: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.')
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Invalid encrypted payload')
  const decipher = createDecipheriv('aes-256-gcm', keyFor(secret), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8')
}

export function maskAccount(last4?: string | null) {
  return last4 ? `•••• ${last4}` : null
}

export function maskUpi(upi?: string | null) {
  if (!upi || !upi.includes('@')) return null
  const [name, handle] = upi.split('@')
  const visible = name.slice(0, Math.min(2, name.length))
  return `${visible}•••@${handle}`
}
