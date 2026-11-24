import { formatInr, rupeesToPaise } from '@aangan/contracts'

export { formatInr, rupeesToPaise }

export function when(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}
