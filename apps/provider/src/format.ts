export function inr(paise?: number | null) {
  if (paise == null) return 'Quote'
  const rupees = paise / 100
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rupees)
}

export function when(value?: string | null) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function kolkataSlot(dayOffset: number, time: string) {
  const day = new Date(Date.now() + dayOffset * 86400000)
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(day)
  return new Date(`${ymd}T${time}:00+05:30`).toISOString()
}
